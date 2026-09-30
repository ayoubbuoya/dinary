# Dinary cloud setup (MongoDB Atlas + Vercel + phone)

This guide moves Dinary from "data only on the phone" to "data in MongoDB Atlas", with a website on Vercel. Follow the steps in order.

## 1. Create the MongoDB Atlas database

1. Go to <https://cloud.mongodb.com> and create a free cluster (M0 is enough for one person).
2. **Database Access** → add a database user with a long random password. Give it "Read and write to any database" (or only the `dinary` database).
3. **Network Access** → add `0.0.0.0/0`. Vercel functions do not have fixed IP addresses, so Atlas must accept any IP. The database user password is what protects the data, so keep it long.
4. **Connect → Drivers** → copy the connection string. It looks like
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`.

You do not need to create collections. Dinary creates them, the indexes and the four default accounts on first use.

## 2. Run it on your computer (optional but recommended)

1. Copy `.env.example` to `.env.local` and fill in the values. Generate the session secret with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
2. `npm install`, then `npx expo start`. Press `w` for the website. The same dev server also serves the API, so the phone (development build) works too without `EXPO_PUBLIC_API_URL`.

## 3. Deploy the website on Vercel

1. Import the GitHub repository in Vercel. `vercel.json` already sets the build command (`npx expo export -p web`), the output folder and the function.
2. **Settings → Environment Variables** — add for Production (and Preview if you use it):
   - `MONGODB_URI`
   - `MONGODB_DB_NAME` = `dinary`
   - `DINARY_PASSWORD`
   - `DINARY_SESSION_SECRET`
3. Deploy. Open your `https://<project>.vercel.app` address: you should see the password screen.

## 4. Point the phone app at the server and rebuild

The phone needs to know your Vercel address. Add it to the build profile in `eas.json`, for example:

```json
"preview": {
  "distribution": "internal",
  "android": { "buildType": "apk" },
  "env": { "EXPO_PUBLIC_API_URL": "https://<project>.vercel.app" }
}
```

Then build again (`eas build -p android --profile preview`) and install the new APK **over** the old app (do not uninstall it first, or the old SQLite data is deleted with it).

## 5. Move your old phone data to MongoDB

1. Open the new app on the phone and enter your password once.
2. Tap the **D** button on Home (or **Backup** on Transactions).
3. First tap **Save old backup file** and keep the file somewhere safe (Drive, email to yourself…).
4. Tap **Copy old phone data to cloud** and confirm.
5. Open the website: your transactions are there.

Running the copy again is safe: records that are already in the cloud are skipped. The old data stays on the phone and is never changed.

If you already have an old backup JSON file, you can also import it from the website: **Backup → Import a backup file**.

## Testing the API (for development)

`npm run test:api` runs an end-to-end check against a running server. It deletes the database it uses, so it only runs when `MONGODB_DB_NAME` ends with `_test`. See the comment at the top of `scripts/api-smoke-test.mjs`.
