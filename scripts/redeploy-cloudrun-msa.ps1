param(
    [string]$ProjectId = "aivle-team0721",
    [string]$Region = "us-central1",
    [string]$ArtifactRepo = "cloud-run-repo",
    [string]$VectorBucket = "gs://aivle-vector-db",
    [string]$InternalCallbackToken = "",
    [string]$ServiceAccountKeyPath = "",
    [switch]$DeleteExisting = $true
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
    param(
        [string]$Title,
        [scriptblock]$Action
    )
    Write-Host "`n=== $Title ===" -ForegroundColor Cyan
    & $Action
}

function Ensure-Tool {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required but was not found."
    }
}

function Get-DefaultKeyPath {
    return Join-Path (Split-Path -Parent $PSScriptRoot) "aivle-team0721-817da080613c.json"
}

if ([string]::IsNullOrWhiteSpace($ServiceAccountKeyPath)) {
    $ServiceAccountKeyPath = Get-DefaultKeyPath
}

if (-not (Test-Path $ServiceAccountKeyPath)) {
    throw "Service account key file was not found: $ServiceAccountKeyPath"
}

if ([string]::IsNullOrWhiteSpace($InternalCallbackToken)) {
    $InternalCallbackToken = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
}

$root = Split-Path -Parent $PSScriptRoot
$gcloudImage = "gcr.io/google.com/cloudsdktool/google-cloud-cli:stable"
$gcloudBin = "/usr/lib/google-cloud-sdk/bin/gcloud"
$termTopic = "terms-create-request"
$analyzeTopic = "terms-analyze-request"
$createSubscription = "terms-create-request-sub"
$analyzeSubscription = "terms-analyze-request-sub"

function Invoke-GCloud {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    $quotedArgs = $Args | ForEach-Object {
        '"' + ($_ -replace '"', '\"') + '"'
    }
    $joined = [string]::Join(" ", $quotedArgs)
    $command = @"
gcloud auth activate-service-account --key-file=/tmp/key.json >/dev/null &&
$gcloudBin config set project $ProjectId >/dev/null &&
$gcloudBin $joined
"@

    docker run --rm `
        -v "${ServiceAccountKeyPath}:/tmp/key.json:ro" `
        --entrypoint bash `
        $gcloudImage `
        -lc ($command -replace 'gcloud auth', "$gcloudBin auth")
}

function Get-AccessToken {
    return (docker run --rm `
        -v "${ServiceAccountKeyPath}:/tmp/key.json:ro" `
        --entrypoint bash `
        $gcloudImage `
        -lc "$gcloudBin auth activate-service-account --key-file=/tmp/key.json >/dev/null && $gcloudBin auth print-access-token").Trim()
}

function Get-ServiceUrl {
    param([string]$ServiceName)
    $json = Invoke-GCloud run services describe $ServiceName --project $ProjectId --region $Region --format json
    if ([string]::IsNullOrWhiteSpace($json)) {
        throw "Failed to get service description for $ServiceName"
    }
    $obj = $json | ConvertFrom-Json
    return [string]$obj.status.url
}

function Ensure-ArtifactRepo {
    $exists = $false
    try {
        $null = Invoke-GCloud artifacts repositories describe $ArtifactRepo --location $Region --project $ProjectId
        $exists = $true
    } catch {
        Write-Host "Artifact repo describe skipped or failed. Assuming existing repo: $ArtifactRepo"
    }
    if (-not $exists) {
        Write-Host "Artifact repo creation skipped. If pushes fail later, create '$ArtifactRepo' manually."
        return
    }
}

function Delete-ServiceIfExists {
    param([string]$ServiceName)
    try {
        Invoke-GCloud run services describe $ServiceName --project $ProjectId --region $Region *> $null
        Write-Host "Deleting Cloud Run service: $ServiceName"
        Invoke-GCloud run services delete $ServiceName --project $ProjectId --region $Region --quiet | Out-Null
    } catch {
        Write-Host "Skip delete (not found): $ServiceName"
    }
}

function Delete-SubscriptionIfExists {
    param([string]$SubscriptionName)
    try {
        Invoke-GCloud pubsub subscriptions describe $SubscriptionName --project $ProjectId *> $null
        Write-Host "Deleting Pub/Sub subscription: $SubscriptionName"
        Invoke-GCloud pubsub subscriptions delete $SubscriptionName --project $ProjectId --quiet | Out-Null
    } catch {
        Write-Host "Skip delete (not found): $SubscriptionName"
    }
}

function Ensure-Topic {
    param([string]$TopicName)
    try {
        Invoke-GCloud pubsub topics describe $TopicName --project $ProjectId *> $null
        Write-Host "Topic exists: $TopicName"
    } catch {
        Invoke-GCloud pubsub topics create $TopicName --project $ProjectId | Out-Null
    }
}

function Build-JavaService {
    param([string]$ServiceDir)
    Push-Location $ServiceDir
    try {
        mvn -q -DskipTests clean package
    } finally {
        Pop-Location
    }
}

function Build-And-Push {
    param(
        [string]$ContextDir,
        [string]$DockerfilePath,
        [string]$Image
    )
    Push-Location $ContextDir
    try {
        docker buildx build --platform linux/amd64 -t $Image --push -f $DockerfilePath .
    } finally {
        Pop-Location
    }
}

function Deploy-CloudRun {
    param(
        [string]$ServiceName,
        [string]$Image,
        [int]$Port,
        [string]$Memory = "1Gi",
        [string]$Cpu = "1",
        [string]$EnvVars = ""
    )
    $args = @(
        "run", "deploy", $ServiceName,
        "--image", $Image,
        "--project", $ProjectId,
        "--platform", "managed",
        "--region", $Region,
        "--allow-unauthenticated",
        "--port", "$Port",
        "--memory", $Memory,
        "--cpu", $Cpu,
        "--max-instances", "1"
    )
    if ($EnvVars -ne "") {
        $args += @("--set-env-vars", $EnvVars)
    }
    Invoke-GCloud @args | Out-Null
}

function Write-FrontendEnvFile {
    param(
        [string]$FilePath,
        [string]$GatewayBaseUrl,
        [string]$ImageApiBaseUrl,
        [string]$KeywordNerApiBaseUrl,
        [string]$KeywordGraphApiBaseUrl
    )

    $content = @"
REACT_APP_TERM_API_BASE_URL=$GatewayBaseUrl
REACT_APP_USER_API_BASE_URL=$GatewayBaseUrl
REACT_APP_POINT_API_BASE_URL=$GatewayBaseUrl
REACT_APP_QNA_API_BASE_URL=$GatewayBaseUrl
REACT_APP_ANALYZE_API_BASE_URL=$GatewayBaseUrl
REACT_APP_CREATE_API_BASE_URL=$GatewayBaseUrl
REACT_APP_GATEWAY_BASE_URL=$GatewayBaseUrl
REACT_APP_IMAGE_API_BASE_URL=$ImageApiBaseUrl
REACT_APP_KEYWORD_AI_API_BASE_URL=$GatewayBaseUrl/keywords
REACT_APP_KEYWORD_GRAPH_API_BASE_URL=$KeywordGraphApiBaseUrl
REACT_APP_KEYWORD_NER_API_BASE_URL=$KeywordNerApiBaseUrl
REACT_APP_API_TIMEOUT_MS=10000
REACT_APP_FIREBASE_API_KEY=AIzaSyAhh1Z4okTMlBnll_qVf8tijV8Z5DiS4lw
REACT_APP_FIREBASE_AUTH_DOMAIN=aivle-team0721.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://aivle-team0721-default-rtdb.firebaseio.com
REACT_APP_FIREBASE_PROJECT_ID=aivle-team0721
REACT_APP_FIREBASE_STORAGE_BUCKET=aivle-team0721.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=902267887946
REACT_APP_FIREBASE_APP_ID=1:902267887946:web:22e6c9a70fea861955e1b3
"@

    Set-Content -Path $FilePath -Value $content -Encoding UTF8
}

$services = @(
    "gateway-service",
    "front-service",
    "user-service",
    "point-service",
    "term-service",
    "qna-service",
    "create-service",
    "analyze-service",
    "image-service",
    "keywordai-service",
    "keywordgraph-service",
    "keywordner-service"
)

$legacyServices = @(
    "terms-api-service",
    "graph-api-service",
    "ner-api-service",
    "image-ai-service"
)

$images = @{
    "keywordner-service"   = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo/keywordner-service:latest"
    "keywordgraph-service" = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo/keywordgraph-service:latest"
    "keywordai-service"    = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo/keywordai-service:latest"
    "image-service"        = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo/image-service:latest"
    "point-service"        = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo/point-service:latest"
    "user-service"         = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo/user-service:latest"
    "qna-service"          = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo/qna-service:latest"
    "term-service"         = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo/term-service:latest"
    "create-service"       = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo/create-service:latest"
    "analyze-service"      = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo/analyze-service:latest"
    "front-service"        = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo/front-service:latest"
    "gateway-service"      = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo/gateway-service:latest"
}

Invoke-Step "Check local tools" {
    Ensure-Tool "docker"
    Ensure-Tool "mvn"
    Ensure-Tool "npm"
}

Invoke-Step "Configure Google Cloud access and Docker auth" {
    Ensure-ArtifactRepo
    $token = Get-AccessToken
    $token | docker login -u oauth2accesstoken --password-stdin "$Region-docker.pkg.dev" | Out-Null
    cmd /c "docker buildx create --name codex-cloudrun-builder --use >nul 2>&1"
    cmd /c "docker buildx inspect --bootstrap >nul 2>&1"
}

if ($DeleteExisting) {
    Invoke-Step "Delete existing Cloud Run services and Pub/Sub subscriptions" {
        foreach ($service in ($services + $legacyServices | Select-Object -Unique)) {
            Delete-ServiceIfExists $service
        }
        Delete-SubscriptionIfExists $createSubscription
        Delete-SubscriptionIfExists $analyzeSubscription
    }
}

Invoke-Step "Build Java services" {
    Build-JavaService (Join-Path $root "gateway")
    Build-JavaService (Join-Path $root "user")
    Build-JavaService (Join-Path $root "point")
    Build-JavaService (Join-Path $root "qna")
    Build-JavaService (Join-Path $root "term")
}

Invoke-Step "Deploy keywordner-service" {
    Build-And-Push (Join-Path $root "keywords-ner") "Dockerfile" $images["keywordner-service"]
    Deploy-CloudRun "keywordner-service" $images["keywordner-service"] 8080 "2Gi" "1" "GCP_PROJECT=$ProjectId,GCP_LOCATION=$Region"
}
$keywordNerUrl = Get-ServiceUrl "keywordner-service"

Invoke-Step "Deploy keywordgraph-service" {
    Build-And-Push (Join-Path $root "keywords-graph") "Dockerfile" $images["keywordgraph-service"]
    Deploy-CloudRun "keywordgraph-service" $images["keywordgraph-service"] 8080 "1Gi" "1" "NER_BASE_URL=$keywordNerUrl"
}
$keywordGraphUrl = Get-ServiceUrl "keywordgraph-service"

Invoke-Step "Deploy keywordai-service" {
    Build-And-Push (Join-Path $root "keywords_ai") "Dockerfile" $images["keywordai-service"]
    Deploy-CloudRun "keywordai-service" $images["keywordai-service"] 8080 "2Gi" "1" "GCP_PROJECT=$ProjectId,GCP_LOCATION=$Region"
}
$keywordAiUrl = Get-ServiceUrl "keywordai-service"

Invoke-Step "Deploy image-service" {
    Build-And-Push (Join-Path $root "image_ai") "Dockerfile" $images["image-service"]
    Deploy-CloudRun "image-service" $images["image-service"] 8080 "2Gi" "2" ""
}
$imageUrl = Get-ServiceUrl "image-service"

Invoke-Step "Deploy point-service" {
    Build-And-Push (Join-Path $root "point") "Dockerfile" $images["point-service"]
    Deploy-CloudRun "point-service" $images["point-service"] 8080 "1Gi" "1" "SPRING_PROFILES_ACTIVE=docker,INTERNAL_CALLBACK_TOKEN=$InternalCallbackToken"
}
$pointUrl = Get-ServiceUrl "point-service"

Invoke-Step "Deploy user-service" {
    Build-And-Push (Join-Path $root "user") "Dockerfile" $images["user-service"]
    Deploy-CloudRun "user-service" $images["user-service"] 8080 "1Gi" "1" "SPRING_PROFILES_ACTIVE=docker,POINT_SERVICE_BASE_URL=$pointUrl,POINT_SERVICE_CONNECT_TIMEOUT_MS=3000,POINT_SERVICE_READ_TIMEOUT_MS=10000,INTERNAL_CALLBACK_TOKEN=$InternalCallbackToken"
}
$userUrl = Get-ServiceUrl "user-service"

Invoke-Step "Deploy qna-service" {
    Build-And-Push (Join-Path $root "qna") "Dockerfile" $images["qna-service"]
    Deploy-CloudRun "qna-service" $images["qna-service"] 8080 "1Gi" "1" "SPRING_PROFILES_ACTIVE=docker"
}
$qnaUrl = Get-ServiceUrl "qna-service"

Invoke-Step "Deploy term-service" {
    Build-And-Push (Join-Path $root "term") "Dockerfile" $images["term-service"]
    Deploy-CloudRun "term-service" $images["term-service"] 8080 "2Gi" "2" "GCP_PROJECT_ID=$ProjectId,PUBSUB_TERMS_CREATE_TOPIC=$termTopic,PUBSUB_TERMS_ANALYZE_TOPIC=$analyzeTopic,POINT_SERVICE_BASE_URL=$pointUrl,CREATE_SERVICE_BASE_URL=https://placeholder,ANALYZE_SERVICE_BASE_URL=https://placeholder,POINT_SERVICE_CONNECT_TIMEOUT_MS=3000,POINT_SERVICE_READ_TIMEOUT_MS=10000,AI_WORKER_CONNECT_TIMEOUT_MS=3000,AI_WORKER_READ_TIMEOUT_MS=15000,INTERNAL_CALLBACK_TOKEN=$InternalCallbackToken,ASYNC_AI_ENABLED=true"
}
$termUrl = Get-ServiceUrl "term-service"

Invoke-Step "Deploy create-service" {
    Build-And-Push (Join-Path $root "ai") "Dockerfile" $images["create-service"]
    Deploy-CloudRun "create-service" $images["create-service"] 8080 "2Gi" "2" "TERM_SERVICE_URL=$termUrl/terms,POINT_SERVICE_URL=$pointUrl,TERM_SERVICE_BASE_URL=$termUrl,INTERNAL_CALLBACK_TOKEN=$InternalCallbackToken,ASYNC_AI_ENABLED=true,TERMS_VECTOR_BUCKET=$VectorBucket"
}
$createUrl = Get-ServiceUrl "create-service"

Invoke-Step "Deploy analyze-service" {
    Build-And-Push (Join-Path $root "analyze_ai") "Dockerfile" $images["analyze-service"]
    Deploy-CloudRun "analyze-service" $images["analyze-service"] 8080 "2Gi" "2" "TERM_SERVICE_BASE_URL=$termUrl,INTERNAL_CALLBACK_TOKEN=$InternalCallbackToken,ASYNC_AI_ENABLED=true,TERMS_VECTOR_BUCKET=$VectorBucket,GCP_PROJECT=$ProjectId,GCP_LOCATION=$Region"
}
$analyzeUrl = Get-ServiceUrl "analyze-service"

Invoke-Step "Create Pub/Sub topics and push subscriptions" {
    Ensure-Topic $termTopic
    Ensure-Topic $analyzeTopic

    $createPush = "$createUrl/internal/pubsub/terms-create?token=$InternalCallbackToken"
    $analyzePush = "$analyzeUrl/internal/pubsub/terms-analyze?token=$InternalCallbackToken"

    Invoke-GCloud pubsub subscriptions create $createSubscription --project $ProjectId --topic $termTopic --push-endpoint $createPush --ack-deadline 600 | Out-Null
    Invoke-GCloud pubsub subscriptions create $analyzeSubscription --project $ProjectId --topic $analyzeTopic --push-endpoint $analyzePush --ack-deadline 600 | Out-Null
}

Invoke-Step "Build temporary front-service" {
    Write-FrontendEnvFile `
        -FilePath (Join-Path $root "frontend/.env.production") `
        -GatewayBaseUrl $termUrl `
        -ImageApiBaseUrl $imageUrl `
        -KeywordNerApiBaseUrl $keywordNerUrl `
        -KeywordGraphApiBaseUrl $keywordGraphUrl

    Build-And-Push (Join-Path $root "frontend") "Dockerfile" $images["front-service"]
    Deploy-CloudRun "front-service" $images["front-service"] 8080 "1Gi" "1" ""
}
$frontUrl = Get-ServiceUrl "front-service"

Invoke-Step "Deploy gateway-service" {
    Build-And-Push (Join-Path $root "gateway") "Dockerfile" $images["gateway-service"]
    Deploy-CloudRun "gateway-service" $images["gateway-service"] 8080 "1Gi" "1" "SPRING_PROFILES_ACTIVE=docker,FRONTEND_URL=$frontUrl,FRONT_SERVICE_URL=$frontUrl,TERM_SERVICE_URL=$termUrl,POINT_SERVICE_URL=$pointUrl,USER_SERVICE_URL=$userUrl,QNA_SERVICE_URL=$qnaUrl,KEYWORD_NER_SERVICE_URL=$keywordNerUrl,KEYWORD_AI_SERVICE_URL=$keywordAiUrl,KEYWORD_GRAPH_SERVICE_URL=$keywordGraphUrl,IMAGE_SERVICE_URL=$imageUrl"
}
$gatewayUrl = Get-ServiceUrl "gateway-service"

Invoke-Step "Rebuild front-service with Gateway URLs" {
    Write-FrontendEnvFile `
        -FilePath (Join-Path $root "frontend/.env.production") `
        -GatewayBaseUrl $gatewayUrl `
        -ImageApiBaseUrl "$gatewayUrl/image" `
        -KeywordNerApiBaseUrl "$gatewayUrl/ner" `
        -KeywordGraphApiBaseUrl "$gatewayUrl/graph"

    Build-And-Push (Join-Path $root "frontend") "Dockerfile" $images["front-service"]
    Deploy-CloudRun "front-service" $images["front-service"] 8080 "1Gi" "1" ""
}
$frontUrl = Get-ServiceUrl "front-service"

Write-Host "`n=== Deployment Complete ===" -ForegroundColor Green
Write-Host "Gateway URL       : $gatewayUrl"
Write-Host "Front URL         : $frontUrl"
Write-Host "User URL          : $userUrl"
Write-Host "Point URL         : $pointUrl"
Write-Host "Term URL          : $termUrl"
Write-Host "QnA URL           : $qnaUrl"
Write-Host "Create URL        : $createUrl"
Write-Host "Analyze URL       : $analyzeUrl"
Write-Host "Image URL         : $imageUrl"
Write-Host "Keyword AI URL    : $keywordAiUrl"
Write-Host "Keyword NER URL   : $keywordNerUrl"
Write-Host "Keyword Graph URL : $keywordGraphUrl"
Write-Host "Internal Token    : $InternalCallbackToken"
