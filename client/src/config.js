const ROOT_URL = window.__APP_CONFIG__?.API_URL
  ? (window.__APP_CONFIG__.API_URL.endsWith('/') ? window.__APP_CONFIG__.API_URL : `${window.__APP_CONFIG__.API_URL}/`)
  : 'http://localhost:5000/api/';

const config = {
  REST_API: {
    Auth: {
      Login: `${ROOT_URL}auth/login`,
      Session: `${ROOT_URL}auth/session`,
      ForgotPassword: `${ROOT_URL}auth/forgot-password`,
      ChangePassword: `${ROOT_URL}auth/change-password`,
    },
    Customer: {
      Session: `${ROOT_URL}customer/session`,
      ProfilePicture: `${ROOT_URL}customer/profile-picture`,
    },
    Basic: {
      ProfilePicture: `${ROOT_URL}basic/profile-picture`,
    },
    Supervisor: {
      Profile: `${ROOT_URL}supervisor/profile`,
      ProfilePicture: `${ROOT_URL}supervisor/profile-picture`,
      Customers: `${ROOT_URL}supervisor/customers`,
      AuditLogs: `${ROOT_URL}supervisor/audit-logs`,
    },
    Signup: {
      Request: `${ROOT_URL}signup/request`,
      Verify: `${ROOT_URL}signup/verify`,
    },
    Review: {
      Applications: `${ROOT_URL}review/applications`,
      GetApplicationByPhone: (phone) => `${ROOT_URL}review/applications/${phone}`,
      SubmitDecision: (phone) => `${ROOT_URL}review/applications/${phone}/decision`,
    },
    Basic: {
      Customers: `${ROOT_URL}basic/customers`,
    },
    Internal: {
      CustomerProfile: (phone) => `${ROOT_URL}internal/customers/${encodeURIComponent(phone)}/profile`,
    },
    Uploads: {
      Transactions: `${ROOT_URL}uploads/transactions`,
    },
    Tiers: {
      Thresholds: `${ROOT_URL}tier-thresholds`,
      CustomerTier: (phone) => `${ROOT_URL}review/customers/${encodeURIComponent(phone)}/tier`,
      ManualTiers: `${ROOT_URL}review/customers/manual-tiers`,
      RevertCustomerTier: (phone) => `${ROOT_URL}review/customers/${encodeURIComponent(phone)}/tier/revert`,
    },
  },
}

export default config
