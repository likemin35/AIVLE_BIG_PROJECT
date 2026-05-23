package self.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import self.domain.Term;
import self.domain.TermJob;
import self.domain.TermJobRepository;
import self.domain.TermRepository;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AsyncAiJobServiceTest {

    private TermJobRepository termJobRepository;
    private TermRepository termRepository;
    private PubSubPublisherService publisherService;
    private PointClient pointClient;
    private AiWorkerClient aiWorkerClient;
    private AsyncAiJobService asyncAiJobService;

    @BeforeEach
    void setUp() {
        termJobRepository = mock(TermJobRepository.class);
        termRepository = mock(TermRepository.class);
        publisherService = mock(PubSubPublisherService.class);
        pointClient = mock(PointClient.class);
        aiWorkerClient = mock(AiWorkerClient.class);
        asyncAiJobService = new AsyncAiJobService(
            termJobRepository,
            termRepository,
            publisherService,
            pointClient,
            aiWorkerClient
        );
        ReflectionTestUtils.setField(asyncAiJobService, "asyncAiEnabled", false);
        ReflectionTestUtils.setField(asyncAiJobService, "createTopic", "terms-create-request");
        ReflectionTestUtils.setField(asyncAiJobService, "analyzeTopic", "terms-analyze-request");
    }

    @Test
    void createCreateJob_savesPendingJobAndDispatches() throws Exception {
        when(pointClient.reserve(any(), eq("user-1"), eq(5000), any())).thenReturn(new HashMap<>());
        when(termJobRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        TermJob job = asyncAiJobService.createCreateJob(
            "user-1",
            "company",
            "insurance",
            "product",
            "2026-05-21",
            "requirements",
            "csv".getBytes(),
            "product_info.csv",
            "text/csv"
        );

        assertNotNull(job.getId());
        assertEquals(TermJob.STATUS_PENDING, job.getStatus());
        verify(termJobRepository).save(any(TermJob.class));
        verify(aiWorkerClient).dispatchCreate(anyMap());
    }

    @Test
    void completeCreateJob_marksDoneAndSetsResultId() throws Exception {
        TermJob job = new TermJob();
        job.setId("job-1");
        job.setUserId("user-1");
        job.setType(TermJob.TYPE_CREATE);
        job.setStatus(TermJob.STATUS_PENDING);
        job.setReservationId("job-1");
        job.setRequestPayload(new HashMap<>());

        when(termJobRepository.findById("job-1")).thenReturn(Optional.of(job));
        when(termJobRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(pointClient.confirm("job-1")).thenReturn(new HashMap<>());
        when(termRepository.save(any())).thenAnswer(invocation -> {
            Term term = invocation.getArgument(0);
            term.setId("term-1");
            return term;
        });

        Map<String, Object> result = new HashMap<>();
        result.put("title", "generated title");
        result.put("content", "generated content");
        Map<String, Object> callback = new HashMap<>();
        callback.put("result", result);

        TermJob completed = asyncAiJobService.completeJob("job-1", callback);

        assertEquals(TermJob.STATUS_DONE, completed.getStatus());
        assertEquals("term-1", completed.getResultId());
        verify(pointClient).confirm("job-1");
    }

    @Test
    void failJob_marksFailedAndCancelsReservation() throws Exception {
        TermJob job = new TermJob();
        job.setId("job-2");
        job.setUserId("user-1");
        job.setType(TermJob.TYPE_ANALYZE);
        job.setStatus(TermJob.STATUS_PENDING);
        job.setReservationId("job-2");

        when(termJobRepository.findById("job-2")).thenReturn(Optional.of(job));
        when(termJobRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(pointClient.cancel("job-2")).thenReturn(new HashMap<>());

        TermJob failed = asyncAiJobService.failJob("job-2", "worker failed");

        assertEquals(TermJob.STATUS_FAILED, failed.getStatus());
        assertEquals("worker failed", failed.getErrorMessage());
        verify(pointClient).cancel("job-2");
    }
}
