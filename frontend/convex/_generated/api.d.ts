/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as ai from "../ai.js";
import type * as aiChat from "../aiChat.js";
import type * as audit from "../audit.js";
import type * as authHelper from "../authHelper.js";
import type * as biosketches from "../biosketches.js";
import type * as compliance from "../compliance.js";
import type * as costs from "../costs.js";
import type * as customAuth from "../customAuth.js";
import type * as dashboard from "../dashboard.js";
import type * as feedback from "../feedback.js";
import type * as files from "../files.js";
import type * as freezer from "../freezer.js";
import type * as grants from "../grants.js";
import type * as incidents from "../incidents.js";
import type * as instruments from "../instruments.js";
import type * as integrations from "../integrations.js";
import type * as inventory from "../inventory.js";
import type * as iot from "../iot.js";
import type * as labMembers from "../labMembers.js";
import type * as labNotebook from "../labNotebook.js";
import type * as maintenance from "../maintenance.js";
import type * as meetings from "../meetings.js";
import type * as notifications from "../notifications.js";
import type * as org from "../org.js";
import type * as payments from "../payments.js";
import type * as procurement from "../procurement.js";
import type * as protocols from "../protocols.js";
import type * as rateLimit from "../rateLimit.js";
import type * as reagentCart from "../reagentCart.js";
import type * as samples from "../samples.js";
import type * as scheduling from "../scheduling.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as seedProdAdmin from "../seedProdAdmin.js";
import type * as settings from "../settings.js";
import type * as sops from "../sops.js";
import type * as suppliers from "../suppliers.js";
import type * as tasks from "../tasks.js";
import type * as templates from "../templates.js";
import type * as totp from "../totp.js";
import type * as training from "../training.js";
import type * as users from "../users.js";
import type * as videoRooms from "../videoRooms.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  ai: typeof ai;
  aiChat: typeof aiChat;
  audit: typeof audit;
  authHelper: typeof authHelper;
  biosketches: typeof biosketches;
  compliance: typeof compliance;
  costs: typeof costs;
  customAuth: typeof customAuth;
  dashboard: typeof dashboard;
  feedback: typeof feedback;
  files: typeof files;
  freezer: typeof freezer;
  grants: typeof grants;
  incidents: typeof incidents;
  instruments: typeof instruments;
  integrations: typeof integrations;
  inventory: typeof inventory;
  iot: typeof iot;
  labMembers: typeof labMembers;
  labNotebook: typeof labNotebook;
  maintenance: typeof maintenance;
  meetings: typeof meetings;
  notifications: typeof notifications;
  org: typeof org;
  payments: typeof payments;
  procurement: typeof procurement;
  protocols: typeof protocols;
  rateLimit: typeof rateLimit;
  reagentCart: typeof reagentCart;
  samples: typeof samples;
  scheduling: typeof scheduling;
  search: typeof search;
  seed: typeof seed;
  seedProdAdmin: typeof seedProdAdmin;
  settings: typeof settings;
  sops: typeof sops;
  suppliers: typeof suppliers;
  tasks: typeof tasks;
  templates: typeof templates;
  totp: typeof totp;
  training: typeof training;
  users: typeof users;
  videoRooms: typeof videoRooms;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
