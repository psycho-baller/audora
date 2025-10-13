/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as conversations from "../conversations.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";
import type * as network from "../network.js";
import type * as realtimeTranscription from "../realtimeTranscription.js";
import type * as speechmatics from "../speechmatics.js";
import type * as speechmaticsBatch from "../speechmaticsBatch.js";
import type * as subscriptions from "../subscriptions.js";
import type * as transcription from "../transcription.js";
import type * as userConnections from "../userConnections.js";
import type * as users from "../users.js";
import type * as vapi from "../vapi.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  conversations: typeof conversations;
  http: typeof http;
  migrations: typeof migrations;
  network: typeof network;
  realtimeTranscription: typeof realtimeTranscription;
  speechmatics: typeof speechmatics;
  speechmaticsBatch: typeof speechmaticsBatch;
  subscriptions: typeof subscriptions;
  transcription: typeof transcription;
  userConnections: typeof userConnections;
  users: typeof users;
  vapi: typeof vapi;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
