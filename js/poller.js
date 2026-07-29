// sutram/js/poller.js
// Standalone background job status polling routine

export function createJobPoller(apiClient) {
    return function pollJob(jobId, options = {}) {
        const { onProgress = ()=>{}, onComplete = ()=>{}, onError = ()=>{}, interval = 1000, maxRetries = 300 } = options;
        let retries = 0;
        
        const poll = async () => {
            try {
                // Tier 0 Agnostic API call
                const res = await apiClient.get(`jobs/${jobId}`);
                
                if (!res.ok) {
                    if (res.status === 404) {
                        try {
                            const errData = await res.clone().json();
                            if (errData.error === "Job not found") {
                                onError(new Error("Job not found."));
                                return;
                            }
                        } catch(e) {}
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
                    onComplete(data);
                } else if (data.status === 'failed') {
                    onError(new Error(data.message || "Job failed."));
                }
            } catch (e) {
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