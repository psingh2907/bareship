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

import { setServices } from '@/shared/services/services';

import { handlers } from './handlers';
import { createMockSocialSignIn } from './social';

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
  const body =
    config.data === undefined || config.data === null || method === 'GET'
      ? undefined
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

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function startMocks(): AxiosAdapter {
  console.log('[mocks] Serving API requests from src/mocks (API_MOCKS=true).');
  // The mock backend can't check real Apple or Google tokens, so the buttons use mock providers.
  setServices({ social: createMockSocialSignIn() });
  return mockAdapter;
}
