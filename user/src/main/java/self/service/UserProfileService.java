package self.service;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.SetOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.google.firebase.auth.UserRecord;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Service
public class UserProfileService {

    private final FirebaseAuth firebaseAuth;
    private final Firestore firestore;
    private final PointBootstrapClient pointBootstrapClient;

    public UserProfileService(FirebaseAuth firebaseAuth, Firestore firestore, PointBootstrapClient pointBootstrapClient) {
        this.firebaseAuth = firebaseAuth;
        this.firestore = firestore;
        this.pointBootstrapClient = pointBootstrapClient;
    }

    public Map<String, Object> getCurrentUserProfile(String authorizationHeader)
        throws FirebaseAuthException, ExecutionException, InterruptedException {
        String token = extractBearerToken(authorizationHeader);
        FirebaseToken decodedToken = firebaseAuth.verifyIdToken(token);
        String uid = decodedToken.getUid();
        UserRecord userRecord = firebaseAuth.getUser(uid);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("uid", uid);
        response.put("email", userRecord.getEmail());
        response.put("emailVerified", userRecord.isEmailVerified());
        response.put("displayName", userRecord.getDisplayName());
        response.put("disabled", userRecord.isDisabled());
        response.put("providerId", userRecord.getProviderData().length == 0
            ? null
            : userRecord.getProviderData()[0].getProviderId());

        DocumentSnapshot snapshot = firestore.collection("users").document(uid).get().get();
        if (snapshot.exists()) {
            Map<String, Object> userDoc = snapshot.getData();
            if (userDoc != null) {
                response.putAll(userDoc);
            }
        }

        return response;
    }

    public Map<String, Object> saveCurrentUserProfile(String authorizationHeader, Map<String, Object> profile)
        throws FirebaseAuthException, ExecutionException, InterruptedException {
        String token = extractBearerToken(authorizationHeader);
        FirebaseToken decodedToken = firebaseAuth.verifyIdToken(token);
        String uid = decodedToken.getUid();
        UserRecord userRecord = firebaseAuth.getUser(uid);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("uid", uid);
        payload.put("email", userRecord.getEmail());
        payload.put("updatedAt", new java.util.Date());
        if (profile != null) {
          payload.putAll(profile);
        }

        firestore.collection("users").document(uid).set(payload, SetOptions.merge()).get();
        try {
            pointBootstrapClient.bootstrap(uid);
        } catch (Exception e) {
            // Do not fail profile save on bootstrap issues; point-service should remain independently recoverable.
        }
        return getCurrentUserProfile(authorizationHeader);
    }

    private String extractBearerToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Invalid Firebase ID token");
        }
        return authorizationHeader.substring(7);
    }
}
