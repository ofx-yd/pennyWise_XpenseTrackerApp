# PennyWise — Frontend

Static frontend for the PennyWise personal finance app. Built with plain HTML, CSS, and JavaScript.

## Project structure -- progress

```
pennywise/
├── login.html
├── signup.html
└── static/
    ├── css/
    │   ├── login.css
    │   └── signup.css
    └── js/
        ├── login.js
        └── signup.js
```

## Running locally

Open the project with **Live Server** in VS Code — right-click `login.html` and select "Open with Live Server".

The app will be served at `http://127.0.0.1:5500`.

> Make sure the backend is running at `http://localhost` before using the forms.

## API connection

All API calls point to `http://localhost`. This is set at the top of each JS file:

```js
const API_BASE = 'http://localhost';
```

If your backend runs on a different port, update this value in both `login.js` and `signup.js`.

## Auth flow

1. User fills in the signup form → `POST /register`
2. A verification email is sent — user must click the link before they can log in
3. User logs in → `POST /login`
4. On success the session cookie is set by the backend and the user is redirected to `dashboard.html`

## Notes

- Passwords must be at least 6 characters, contain 1 uppercase letter and 1 number
- The login form accepts either a username or email address
- "Remember me" saves the username/email to `localStorage` so it pre-fills on next visit
