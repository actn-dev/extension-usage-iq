import { authClient } from "@src/lib/auth/auth-client";

export function Login() {
    const session = authClient.useSession();
    async function handleLogin() {
        const data = await authClient.signIn.social({
            provider: "google",
        });

        // Implement login logic here
        console.log("Login button clicked", data);
    }

    function SessionState() {
        if (session.isPending) return <div>Loading...</div>;
        if (session.error) return <div>Error: {session.error.message}</div>;

        if (session.data) return <div>Welcome, {session.data.user.email}! <button onClick={() => authClient.signOut()}>Logout</button></div>;

    }



    return <div><SessionState /><button onClick={handleLogin}>Login</button></div>;
}