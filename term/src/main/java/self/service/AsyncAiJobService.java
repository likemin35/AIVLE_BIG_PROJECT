package self.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import self.domain.Term;
import self.domain.TermJob;
import self.domain.TermJobRepository;
import self.domain.TermRepository;

import java.io.IOException;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Service
public class AsyncAiJobService {

    private static final int AI_POINT_COST = 5000;

    @Value("${PUBSUB_TERMS_CREATE_TOPIC:terms-create-request}")
    private String createTopic;

    @Value("${PUBSUB_TERMS_ANALYZE_TOPIC:terms-analyze-request}")
    private String analyzeTopic;

    @Value("${ASYNC_AI_ENABLED:true}")
    private boolean asyncAiEnabled;

    private final TermJobRepository termJobRepository;
    private final TermRepository termRepository;
    private final PubSubPublisherService pubSubPublisherService;
    private final PointClient pointClient;
    private final AiWorkerClient aiWorkerClient;

    public AsyncAiJobService(
        TermJobRepository termJobRepository,
        TermRepository termRepository,
        PubSubPublisherService pubSubPublisherService,
        PointClient pointClient,
        AiWorkerClient aiWorkerClient
    ) {
        this.termJobRepository = termJobRepository;
        this.termRepository = termRepository;
        this.pubSubPublisherService = pubSubPublisherService;
        this.pointClient = pointClient;
        this.aiWorkerClient = aiWorkerClient;
    }

    public TermJob createCreateJob(
        String userId,
        String companyName,
        String category,
        String productName,
        String effectiveDate,
        String requirements,
        byte[] productMetaBytes,
        String productMetaFilename,
        String productMetaContentType
    ) throws Exception {
        String jobId = UUID.randomUUID().toString();
        String reservationId = jobId;
        String description = "AI 약관 초안 생성";

        pointClient.reserve(reservationId, userId, AI_POINT_COST, description);

        Map<String, Object> payload = new HashMap<>();
        payload.put("jobId", jobId);
        payload.put("userId", userId);
        payload.put("type", TermJob.TYPE_CREATE);
        payload.put("companyName", companyName);
        payload.put("category", category);
        payload.put("productName", productName);
        payload.put("effectiveDate", effectiveDate);
        payload.put("requirements", requirements);
        payload.put("productMetaFilename", productMetaFilename);
        payload.put("productMetaContentType", productMetaContentType);
        payload.put("productMetaBase64", productMetaBytes == null ? null : Base64.getEncoder().encodeToString(productMetaBytes));
        payload.put("payloadVersion", "v1");
        payload.put("requestedAt", new Date().getTime());

        TermJob job = new TermJob();
        Date now = new Date();
        job.setId(jobId);
        job.setUserId(userId);
        job.setType(TermJob.TYPE_CREATE);
        job.setStatus(TermJob.STATUS_PENDING);
        job.setReservationId(reservationId);
        job.setCreatedAt(now);
        job.setUpdatedAt(now);
        job.setRequestPayload(payload);

        try {
            termJobRepository.save(job);
            dispatch(job.getType(), payload);
            return job;
        } catch (Exception e) {
            pointClient.cancel(reservationId);
            throw e;
        }
    }

    public TermJob createAnalyzeJob(String userId, String termId, String category)
        throws ExecutionException, InterruptedException {
        Term term = termRepository.findById(termId)
            .orElseThrow(() -> new IllegalArgumentException("Term not found: " + termId));

        return createAnalyzeJobInternal(userId, termId, category, term.getContent(), term.getTitle());
    }

    public TermJob createAnalyzeTextJob(String userId, String category, String text, String title)
        throws ExecutionException, InterruptedException {
        return createAnalyzeJobInternal(userId, null, category, text, title);
    }

    private TermJob createAnalyzeJobInternal(String userId, String termId, String category, String text, String title)
        throws ExecutionException, InterruptedException {
        String jobId = UUID.randomUUID().toString();
        String reservationId = jobId;
        String description = "AI 약관 리스크 분석";

        pointClient.reserve(reservationId, userId, AI_POINT_COST, description);

        Map<String, Object> payload = new HashMap<>();
        payload.put("jobId", jobId);
        payload.put("userId", userId);
        payload.put("termId", termId);
        payload.put("type", TermJob.TYPE_ANALYZE);
        payload.put("category", category);
        payload.put("text", text);
        payload.put("title", title);
        payload.put("payloadVersion", "v1");
        payload.put("requestedAt", new Date().getTime());

        TermJob job = new TermJob();
        Date now = new Date();
        job.setId(jobId);
        job.setUserId(userId);
        job.setType(TermJob.TYPE_ANALYZE);
        job.setStatus(TermJob.STATUS_PENDING);
        job.setTermId(termId);
        job.setReservationId(reservationId);
        job.setCreatedAt(now);
        job.setUpdatedAt(now);
        job.setRequestPayload(payload);

        try {
            termJobRepository.save(job);
            dispatch(job.getType(), payload);
            return job;
        } catch (Exception e) {
            pointClient.cancel(reservationId);
            throw new IllegalStateException("Failed to create analyze job", e);
        }
    }

    public Optional<TermJob> getJob(String jobId) throws ExecutionException, InterruptedException {
        return termJobRepository.findById(jobId);
    }

    public TermJob completeJob(String jobId, Map<String, Object> callback)
        throws ExecutionException, InterruptedException {
        TermJob job = termJobRepository.findById(jobId)
            .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));

        if (job.isTerminal()) {
            return job;
        }

        Map<String, Object> result = getNestedMap(callback, "result");
        String resultId;

        if (TermJob.TYPE_CREATE.equals(job.getType())) {
            resultId = persistCreatedTerm(job, result);
        } else if (TermJob.TYPE_ANALYZE.equals(job.getType())) {
            resultId = persistAnalysisResult(job, result);
        } else {
            throw new IllegalStateException("Unsupported job type: " + job.getType());
        }

        try {
            pointClient.confirm(job.getReservationId());
            job.setStatus(TermJob.STATUS_DONE);
            job.setResultId(resultId);
            job.setResultPayload(result);
            job.setUpdatedAt(new Date());
            termJobRepository.save(job);
            return job;
        } catch (Exception e) {
            pointClient.cancel(job.getReservationId());
            job.setStatus(TermJob.STATUS_FAILED);
            job.setResultId(resultId);
            job.setErrorMessage("Point confirmation failed: " + e.getMessage());
            job.setResultPayload(result);
            job.setUpdatedAt(new Date());
            termJobRepository.save(job);
            return job;
        }
    }

    public TermJob failJob(String jobId, String errorMessage)
        throws ExecutionException, InterruptedException {
        TermJob job = termJobRepository.findById(jobId)
            .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));

        if (job.isTerminal()) {
            return job;
        }

        pointClient.cancel(job.getReservationId());
        job.setStatus(TermJob.STATUS_FAILED);
        job.setErrorMessage(errorMessage);
        job.setUpdatedAt(new Date());
        termJobRepository.save(job);
        return job;
    }

    private void dispatch(String type, Map<String, Object> payload) throws IOException, ExecutionException, InterruptedException {
        if (asyncAiEnabled) {
            if (TermJob.TYPE_CREATE.equals(type)) {
                pubSubPublisherService.publishJson(createTopic, payload);
            } else {
                pubSubPublisherService.publishJson(analyzeTopic, payload);
            }
            return;
        }

        if (TermJob.TYPE_CREATE.equals(type)) {
            aiWorkerClient.dispatchCreate(payload);
        } else {
            aiWorkerClient.dispatchAnalyze(payload);
        }
    }

    private String persistCreatedTerm(TermJob job, Map<String, Object> result)
        throws ExecutionException, InterruptedException {
        Term term = new Term();
        Map<String, Object> requestPayload = job.getRequestPayload();
        term.setUserId(job.getUserId());
        term.setTitle(asString(result.getOrDefault("title", requestPayload.getOrDefault("productName", "AI 약관 초안"))));
        term.setCategory(asString(result.getOrDefault("category", requestPayload.get("category"))));
        term.setProductName(asString(result.getOrDefault("productName", requestPayload.get("productName"))));
        term.setRequirement(asString(result.getOrDefault("requirements", requestPayload.get("requirements"))));
        term.setContent(asString(result.getOrDefault("policy", result.getOrDefault("content", ""))));
        term.setVersion("v1");
        term.setCreatedAt(new Date());
        term.setMemo("ASYNC_CREATE_JOB:" + job.getId());
        term.setTermType("AI_CREATED");
        termRepository.save(term);
        return term.getId();
    }

    private String persistAnalysisResult(TermJob job, Map<String, Object> result)
        throws ExecutionException, InterruptedException {
        if (job.getTermId() == null || job.getTermId().isBlank()) {
            return null;
        }

        Term term = termRepository.findById(job.getTermId())
            .orElseThrow(() -> new IllegalArgumentException("Term not found for analysis result: " + job.getTermId()));

        Object analysisText = result.get("text");
        Object results = result.get("results");
        term.setRisk(asString(analysisText));
        try {
            term.setFeedback(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(results));
        } catch (Exception e) {
            term.setFeedback(asString(analysisText));
        }
        term.setModifiedAt(new Date());
        term.setUpdateType("AI_ANALYZE");
        termRepository.save(term);
        return term.getId();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getNestedMap(Map<String, Object> body, String key) {
        Object value = body.get(key);
        if (value instanceof Map) {
            return (Map<String, Object>) value;
        }
        return new HashMap<>();
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
