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
import type * as cartBudgets from "../cartBudgets.js";
import type * as compliance from "../compliance.js";
import type * as costs from "../costs.js";
import type * as crons from "../crons.js";
import type * as cryptoSecrets from "../cryptoSecrets.js";
import type * as customAuth from "../customAuth.js";
import type * as dashboard from "../dashboard.js";
import type * as experiments from "../experiments.js";
import type * as feedback from "../feedback.js";
import type * as files from "../files.js";
import type * as freezer from "../freezer.js";
import type * as funding from "../funding.js";
import type * as grants from "../grants.js";
import type * as http from "../http.js";
import type * as hubs from "../hubs.js";
import type * as incidents from "../incidents.js";
import type * as instrumentBooking from "../instrumentBooking.js";
import type * as instruments from "../instruments.js";
import type * as integrations from "../integrations.js";
import type * as inventory from "../inventory.js";
import type * as inviteEmail from "../inviteEmail.js";
import type * as invites from "../invites.js";
import type * as invoiceMatch from "../invoiceMatch.js";
import type * as iot from "../iot.js";
import type * as labMembers from "../labMembers.js";
import type * as labNotebook from "../labNotebook.js";
import type * as labels from "../labels.js";
import type * as labsAdmin from "../labsAdmin.js";
import type * as maintenance from "../maintenance.js";
import type * as maintenanceFlow from "../maintenanceFlow.js";
import type * as meetings from "../meetings.js";
import type * as migrate from "../migrate.js";
import type * as notifications from "../notifications.js";
import type * as ollama from "../ollama.js";
import type * as org from "../org.js";
import type * as payments from "../payments.js";
import type * as piAccess from "../piAccess.js";
import type * as procurement from "../procurement.js";
import type * as protocolAi from "../protocolAi.js";
import type * as protocolLibrary from "../protocolLibrary.js";
import type * as protocolRules from "../protocolRules.js";
import type * as protocols from "../protocols.js";
import type * as reagentCart from "../reagentCart.js";
import type * as receiving from "../receiving.js";
import type * as reports from "../reports.js";
import type * as samples from "../samples.js";
import type * as scheduling from "../scheduling.js";
import type * as search from "../search.js";
import type * as security from "../security.js";
import type * as seedProdAdmin from "../seedProdAdmin.js";
import type * as settings from "../settings.js";
import type * as sops from "../sops.js";
import type * as stripe from "../stripe.js";
import type * as suppliers from "../suppliers.js";
import type * as swarmFeedback from "../swarmFeedback.js";
import type * as tasks from "../tasks.js";
import type * as templates from "../templates.js";
import type * as tenant from "../tenant.js";
import type * as tenantTables from "../tenantTables.js";
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
  cartBudgets: typeof cartBudgets;
  compliance: typeof compliance;
  costs: typeof costs;
  crons: typeof crons;
  cryptoSecrets: typeof cryptoSecrets;
  customAuth: typeof customAuth;
  dashboard: typeof dashboard;
  experiments: typeof experiments;
  feedback: typeof feedback;
  files: typeof files;
  freezer: typeof freezer;
  funding: typeof funding;
  grants: typeof grants;
  http: typeof http;
  hubs: typeof hubs;
  incidents: typeof incidents;
  instrumentBooking: typeof instrumentBooking;
  instruments: typeof instruments;
  integrations: typeof integrations;
  inventory: typeof inventory;
  inviteEmail: typeof inviteEmail;
  invites: typeof invites;
  invoiceMatch: typeof invoiceMatch;
  iot: typeof iot;
  labMembers: typeof labMembers;
  labNotebook: typeof labNotebook;
  labels: typeof labels;
  labsAdmin: typeof labsAdmin;
  maintenance: typeof maintenance;
  maintenanceFlow: typeof maintenanceFlow;
  meetings: typeof meetings;
  migrate: typeof migrate;
  notifications: typeof notifications;
  ollama: typeof ollama;
  org: typeof org;
  payments: typeof payments;
  piAccess: typeof piAccess;
  procurement: typeof procurement;
  protocolAi: typeof protocolAi;
  protocolLibrary: typeof protocolLibrary;
  protocolRules: typeof protocolRules;
  protocols: typeof protocols;
  reagentCart: typeof reagentCart;
  receiving: typeof receiving;
  reports: typeof reports;
  samples: typeof samples;
  scheduling: typeof scheduling;
  search: typeof search;
  security: typeof security;
  seedProdAdmin: typeof seedProdAdmin;
  settings: typeof settings;
  sops: typeof sops;
  stripe: typeof stripe;
  suppliers: typeof suppliers;
  swarmFeedback: typeof swarmFeedback;
  tasks: typeof tasks;
  templates: typeof templates;
  tenant: typeof tenant;
  tenantTables: typeof tenantTables;
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
