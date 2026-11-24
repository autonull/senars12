/**
 * Metrics Registry — unified metrics collection for Prometheus and OpenTelemetry.
 */

import { metrics, MeterProvider } from '@opentelemetry/api-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import * as resources from '@opentelemetry/resources';
import * as sdkMetrics from '@opentelemetry/sdk-metrics';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const ResourceValue = resources.Resource;
const MeterProviderValue = sdkMetrics.MeterProvider;

let _meterProvider: MeterProvider | null = null;
let _prometheusExporter: PrometheusExporter | null = null;
let _initialized = false;

export interface MetricsConfig {
  /** Service name for resource attribution. */
  serviceName?: string;
  /** Prometheus exporter port. */
  prometheusPort?: number;
  /** Prometheus exporter endpoint. */
  prometheusEndpoint?: string;
  /** Export interval in milliseconds. */
  exportIntervalMs?: number;
  /** Whether to enable Prometheus exporter. */
  enablePrometheus?: boolean;
}

/** Initialize the metrics pipeline. */
export async function initMetrics(config: MetricsConfig = {}): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  const {
    serviceName = 'senars-cognitive-kernel',
    prometheusPort = 9464,
    prometheusEndpoint = '/metrics',
    exportIntervalMs = 10000,
    enablePrometheus = true,
  } = config;

  const readers = [];

  if (enablePrometheus) {
    _prometheusExporter = new PrometheusExporter(
      { port: prometheusPort, endpoint: prometheusEndpoint },
      () => console.log(`Prometheus metrics available at http://localhost:${prometheusPort}${prometheusEndpoint}`)
    );
    // Prometheus exporter is pull-based, add directly to readers
    readers.push(_prometheusExporter);
  }

  const provider = new MeterProviderValue({
    resource: new ResourceValue({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
    readers,
  });

  metrics.setGlobalMeterProvider(provider);
  _meterProvider = provider;
}

/** Get the global meter provider. */
export function getMeterProvider(): MeterProvider | null {
  return _meterProvider;
}

/** Get a meter for a specific component. */
export function getMeter(name: string, version?: string) {
  const provider = metrics.getMeterProvider();
  return provider.getMeter(name, version);
}

/** Shutdown the metrics pipeline. */
export async function shutdownMetrics(): Promise<void> {
  if (_prometheusExporter) {
    await _prometheusExporter.shutdown();
    _prometheusExporter = null;
  }
  _meterProvider = null;
  _initialized = false;
}

/** Check if metrics are initialized. */
export function isMetricsInitialized(): boolean {
  return _initialized;
}