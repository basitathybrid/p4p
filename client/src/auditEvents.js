export const AUDIT_LOG_UPDATED_EVENT = 'p4p:audit-log-updated'

export function notifyAuditLogUpdated() {
  window.dispatchEvent(new Event(AUDIT_LOG_UPDATED_EVENT))
}