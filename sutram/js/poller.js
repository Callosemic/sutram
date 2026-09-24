// sutram/js/poller.js
// Standalone background job status polling routine
export function createJobPoller(apiClient) {
    return function pollJob(jobId, options = {}) {
        const { onProgress = ()=>{}, onComplete = ()=>{}, onError = ()=>{}, interval = 1000, maxRetries = 300 } = options;

        if (jobId === 'offline_queue') {
            onComplete({ status: 'completed', message: 'Queued for offline sync.' });
            return;
        }
        let retries = 0;

        const poll = async () => {
            // Yield to the OS offline state to prevent useless network spam while disconnected
            const isOffline = window.Sutram?.stores?.Environment?.getState()?.isOffline;
            if (isOffline) {
                setTimeout(poll, interval);
                return;
            }

            try {
                // Tier 0 Agnostic API call
                const res = await apiClient.get(`jobs/${jobId}`);
                if (!res.ok) {
                    if (res.status === 404) {
                        let msg = "Job not found.";
                        try {
                            const errData = await res.clone().json();
                            msg = errData.message || errData.error || msg;
                        } catch(e) {}
                        onError(new Error(msg));
                        return;
                    }

                    // Allow downstream SDKs to intercept 401s for token rotation
                    if (res.status === 401 && typeof apiClient.handleUnauthorized === 'function') {
                        await apiClient.handleUnauthorized();
                    }

                    throw new Error(`HTTP ${res.status}`);
                }
                
                const data = await res.json();
                if (data.status === 'processing' || data.status === 'pending') {
                    onProgress(data.message || "Processing...", data);
                    if (retries < maxRetries) {
                        retries++;
                        setTimeout(poll, interval);
                    } else {
                        onError(new Error("Job polling timed out."));
                    }
                } else if (data.status === 'completed') {
                    if (data.artifact && data.artifact.next_job_id) {
                        jobId = data.artifact.next_job_id;
                        setTimeout(poll, 50);
                    } else {
                        onComplete(data);
                    }
                } else if (data.status === 'failed') {
                    onError(new Error(data.message || "Job failed."));
                }
            } catch (e) {
                if (e.name === 'AbortError') return; // Exit cleanly on workspace swap
                if (retries < maxRetries) {
                    retries++;
                    setTimeout(poll, interval);
                } else {
                    onError(e);
                }
            }
        };
        
        setTimeout(poll, 500);
    };
}