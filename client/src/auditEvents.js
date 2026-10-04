export const AUDIT_LOG_UPDATED_EVENT = 'p4p:audit-log-updated'

export function notifyAuditLogUpdated() {
  window.dispatchEvent(new Event(AUDIT_LOG_UPDATED_EVENT))
}

export const CUSTOMER_STATUS_UPDATED_EVENT = 'p4p:customer-status-updated'

export function notifyCustomerStatusUpdated() {
  window.dispatchEvent(new Event(CUSTOMER_STATUS_UPDATED_EVENT))
}