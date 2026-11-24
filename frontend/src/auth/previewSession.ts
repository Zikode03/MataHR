import {initialAccounts,roles,type UserRole} from './access';
import {PRIVACY_VERSION} from './PrivacyNotice';
export type PreviewDestination=UserRole;
export type PreviewSession={accountId:string;destination:PreviewDestination;privacyVersion:string;acknowledgedAt:string};
export const PREVIEW_SESSION_KEY='matahr.preview-session';
// Browser-only acknowledgement state. This is not authentication or authorization.
export function readPreviewSession():PreviewSession|null{
 try{const value=JSON.parse(sessionStorage.getItem(PREVIEW_SESSION_KEY)??'null');return value&&roles.includes(value.destination)&&typeof value.accountId==='string'&&value.privacyVersion===PRIVACY_VERSION&&typeof value.acknowledgedAt==='string'&&Number.isFinite(Date.parse(value.acknowledgedAt))?value:null;}catch{return null;}
}
export function beginPreviewSession(destination:PreviewDestination,accountId=initialAccounts().find(a=>a.role===destination)!.id):PreviewSession{
 const session={destination,accountId,privacyVersion:PRIVACY_VERSION,acknowledgedAt:new Date().toISOString()};try{sessionStorage.setItem(PREVIEW_SESSION_KEY,JSON.stringify(session))}catch{/* The current React session still works if storage is unavailable. */}return session;
}
export function endPreviewSession(){try{sessionStorage.removeItem(PREVIEW_SESSION_KEY)}catch{/* No persisted preview session. */}}
