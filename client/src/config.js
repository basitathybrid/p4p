const ROOT_URL = 'http://localhost:5000/api/';
// const ROOT_URL = 'http://api.play4perks.com/api/';

// const ROOT_URL = import.meta.env.VITE_API_URL
//   ? (import.meta.env.VITE_API_URL.endsWith('/') ? import.meta.env.VITE_API_URL : `${import.meta.env.VITE_API_URL}/`)
//   : 'http://localhost:5000/api/';

const config = {
  REST_API: {
    Auth: {
      Login: `${ROOT_URL}auth/login`,
    },
    Customer: {
      Session: `${ROOT_URL}customer/session`,
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
  },
}

export default config
