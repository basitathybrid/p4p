const ROOT_URL = window.__APP_CONFIG__?.API_URL
  ? (window.__APP_CONFIG__.API_URL.endsWith('/') ? window.__APP_CONFIG__.API_URL : `${window.__APP_CONFIG__.API_URL}/`)
  : 'http://localhost:5000/api/';

const config = {
  REST_API: {
    Auth: {
      Login: `${ROOT_URL}auth/login`,
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
    Uploads: {
      Transactions: `${ROOT_URL}uploads/transactions`,
    },
    Tiers: {
      Thresholds: `${ROOT_URL}tier-thresholds`,
      CustomerTier: (phone) => `${ROOT_URL}review/customers/${encodeURIComponent(phone)}/tier`,
    },
  },
}

export default config
