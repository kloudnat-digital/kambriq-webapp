import type { Server } from 'node:http';

/**
 * The idle timeout of the load balancer in front of the API: the AWS default,
 * since `modules/alb` in kambriq-infra sets no `idle_timeout`, and read live as
 * 60 s on dev.
 */
export const LOAD_BALANCER_IDLE_TIMEOUT_MS = 60_000;

/**
 * A68 - the API keeps an idle connection open longer than the load balancer.
 *
 * The load balancer reuses a connection to the API for up to its idle timeout.
 * Node closes an idle keep-alive connection after 5 s by default, so a request
 * sent on a connection Node was closing got a 502 from the load balancer, and
 * never reached the API. The server therefore outlives the load balancer, and
 * `headersTimeout` outlives `keepAliveTimeout`, as Node requires.
 */
export const outliveTheLoadBalancer = (server: Server): void => {
  server.keepAliveTimeout = LOAD_BALANCER_IDLE_TIMEOUT_MS + 5_000;
  server.headersTimeout = LOAD_BALANCER_IDLE_TIMEOUT_MS + 6_000;
};
