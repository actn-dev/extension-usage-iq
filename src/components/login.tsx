import { authClient } from "@src/lib/auth/auth-client";

export function Login() {
    const session = authClient.useSession();

    async function handleLogin() {
        const data = await authClient.signIn.social({
            provider: "google",
        });
        console.log("Login button clicked", data);
    }

    // async function testApiCall() {
    //     try {
    //         console.log("Calling test API...");
    //         const response = await fetch("http://localhost:3000/api/test-session", {
    //             method: "GET",
    //             credentials: "include",
    //             headers: {
    //                 "Content-Type": "application/json",
    //             },
    //         });

    //         const data = await response.json();
    //         console.log("Test API Response:", data);
    //         alert(`API Response: ${JSON.stringify(data, null, 2)}`);
    //     } catch (error) {
    //         console.error("Test API Error:", error);
    //         alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    //     }
    // }

    if (session.isPending) {
        return <div>Loading...</div>;
    }

    if (session.error) {
        return <div>Error: {session.error.message}</div>;
    }

    if (session.data) {
        return (
            <div>
                <div>Welcome, {session.data.user.email}!</div>
                <button onClick={() => authClient.signOut()}>Logout</button>
            </div>
        );
    }

    return (
        <div>
            <button onClick={handleLogin}>Login</button>
        </div>
    );
}