import { boundedFetch } from '@senars/util/async';
import { endpointPath } from '../providers/probe';
import { SenarsError } from '../../errors/senars-error';
/**
 * The one remote-judge client: bounded POST, health/breaker bookkeeping, and
 * the single-query consensus wrapper. Wire dialects (SeNARS `/v1/systemone`,
 * Open replica) differ only in request shape and response parsing.
 */
export function createRemoteManifold({ backendId, endpoint, embeddingCache, timeoutMs = 30_000, fetchImpl = fetch, errorLabel, buildRequest, parseResponse, }) {
    const url = endpointPath(endpoint, 'v1/systemone');
    const health = {
        backendId,
        ready: true,
        breakerOpen: false,
        rollingEce: 0,
        queueDepth: 0,
    };
    const judgeBatch = async (sharedContext, queries, _budget) => {
        const embedding = embeddingCache.read(sharedContext);
        if (!embedding)
            throw new SenarsError(`Embedding not found for pointer ${sharedContext}`, 'VALIDATION_ERROR');
        try {
            const res = await boundedFetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(buildRequest(embedding, queries)),
            }, { timeoutMs, fetchImpl });
            if (!res.ok)
                throw new SenarsError(`${errorLabel} HTTP ${res.status}`, 'TRANSPORT_ERROR');
            const propositions = parseResponse(await res.json(), queries);
            health.ready = true;
            health.breakerOpen = false;
            return propositions;
        }
        catch (e) {
            health.ready = false;
            health.breakerOpen = true;
            throw e;
        }
    };
    return {
        judgeBatch,
        async consensus(sharedContext, query, k, budget) {
            // One batched remote pass; `k` judges the endpoint's internal fan-out.
            const proposition = (await judgeBatch(sharedContext, [query], budget))[0];
            void k;
            if (!proposition)
                throw new SenarsError(`${errorLabel} returned no proposition for consensus`, 'OPERATION_ERROR');
            return { proposition, agreement: 1, independent: false };
        },
        health: () => ({ ...health }),
    };
}
