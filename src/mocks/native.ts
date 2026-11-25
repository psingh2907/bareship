// Polyfills first: MSW's core reads a few browser globals when it loads.
import './polyfills';

import axios, {
  type AxiosAdapter,
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  CanceledError,
} from 'axios';
import { getResponse } from 'msw';

import { env } from '@/shared/config/env'; // @social
import { setServices } from '@/shared/services/services'; // @social

import { handlers } from './handlers';
import { createMockSocialSignIn } from './social'; // @social

/**
 * In-app mock backend for development builds (API_MOCKS=true).
 *
 * Instead of patching XMLHttpRequest/fetch globally (fragile on Hermes), the HTTP client gets this axios
 * adapter: each request becomes a standard `Request`, MSW's `getResponse()` runs the same handlers the
 * tests use, and the `Response` is mapped back to axios. Requests no handler matches go to the network.
 */
export const mockAdapter: AxiosAdapter = async config => {
  if (config.signal?.aborted) throw new CanceledError(undefined, undefined, config);

  const url = axios.getUri(config);
  const headers = new Headers();
  Object.entries(AxiosHeaders.from(config.headers).toJSON()).forEach(([key, value]) => {
    if (value !== undefined && value !== null) headers.set(key, String(value));
  });
  const method = (config.method ?? 'get').toUpperCase();
  const parts = formDataParts(config.data);
  if (parts) {
    // MSW can't read React Native's FormData (its file parts are URIs, not bytes): send the parts as
    // JSON, and report upload progress the way the real transport would.
    headers.set('Content-Type', 'application/json');
    await simulateUploadProgress(config);
  }
  const body =
    config.data === undefined || config.data === null || method === 'GET'
      ? undefined
      : parts
        ? JSON.stringify({ parts })
        : typeof config.data === 'string'
          ? config.data
          : JSON.stringify(config.data);

  const response = await getResponse(handlers, new Request(url, { method, headers, body }));
  if (!response) {
    const network = axios.getAdapter(['xhr', 'fetch']);
    return network(config);
  }

  const text = await response.text();
  const result: AxiosResponse = {
    data: text ? parseJson(text) : '',
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    config,
    request: {},
  };
  if (response.type === 'error') {
    throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
  }
  if (config.validateStatus && !config.validateStatus(response.status)) {
    throw new AxiosError(
      `Request failed with status code ${response.status}`,
      response.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      {},
      result,
    );
  }
  return result;
};

type FormDataWithParts = { getParts: () => Array<Record<string, unknown>> };

function formDataParts(data: unknown): Array<Record<string, unknown>> | null {
  return data instanceof FormData &&
    typeof (data as unknown as FormDataWithParts).getParts === 'function'
    ? (data as unknown as FormDataWithParts).getParts()
    : null;
}

const UPLOAD_STEPS = 12;
const UPLOAD_STEP_MS = 120;

/** About 1.5 s of progress events, stopping early if the request is aborted. */
async function simulateUploadProgress(config: Parameters<AxiosAdapter>[0]) {
  const total = 1_000_000;
  for (let step = 1; step <= UPLOAD_STEPS; step++) {
    await new Promise(resolve => setTimeout(resolve, UPLOAD_STEP_MS));
    if (config.signal?.aborted) throw new CanceledError(undefined, undefined, config);
    const loaded = Math.round((total * step) / UPLOAD_STEPS);
    config.onUploadProgress?.({
      loaded,
      total,
      progress: loaded / total,
      bytes: total / UPLOAD_STEPS,
      lengthComputable: true,
      upload: true,
    });
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function startMocks(): AxiosAdapter {
  console.log('[mocks] Serving API requests from src/mocks (API_MOCKS=true).');
  // @social-start
  // The mock backend can't check real Apple or Google tokens, so the buttons use mock providers.
  if (env.SOCIAL_SIGN_IN_MOCKS) setServices({ social: createMockSocialSignIn() });
  // @social-end
  return mockAdapter;
}
