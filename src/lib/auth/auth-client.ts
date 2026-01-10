import { API_BASE_URL } from "@src/utils/apiClient";
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
    baseURL: API_BASE_URL /* Base URL of your Better Auth backend. */,
    plugins: [],
});