import { authClient } from "@src/lib/auth/auth-client";
import { OrganizationSelector } from "./organization-selector";
import { getAuthManager } from "@src/utils/authManager";
import { useState, useEffect } from "react";

export function Login() {
    const session = authClient.useSession();
    const [showOrgSelector, setShowOrgSelector] = useState(false);
    const [hasActiveOrg, setHasActiveOrg] = useState(false);

    useEffect(() => {
        checkActiveOrganization();
    }, [session.data]);

    async function checkActiveOrganization() {
        if (session.data) {
            const authManager = getAuthManager();
            const hasOrg = await authManager.hasActiveOrganization();
            setHasActiveOrg(hasOrg);
            setShowOrgSelector(!hasOrg);
        }
    }

    async function handleLogin() {
        const data = await authClient.signIn.social({
            provider: "google",
        });
        console.log("Login button clicked", data);
    }

    async function handleLogout() {
        await authClient.signOut();
        // Clear organization data
        const authManager = getAuthManager();
        await authManager.clearActiveOrganization();
        setHasActiveOrg(false);
        setShowOrgSelector(false);
    }

    function handleOrganizationSelected() {
        setHasActiveOrg(true);
        setShowOrgSelector(false);
    }

    function handleChangeOrganization() {
        setShowOrgSelector(true);
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
            <div className="p-4">
                {showOrgSelector ? (
                    <div>
                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-2">
                                Welcome, {session.data.user.email}!
                            </p>
                        </div>
                        <OrganizationSelector onOrganizationSelected={handleOrganizationSelected} />
                    </div>
                ) : (
                    <div>
                        <div className="mb-4">
                            <p className="text-sm font-medium">Welcome, {session.data.user.email}!</p>
                            {hasActiveOrg && (
                                <p className="text-xs text-green-600 mt-1">
                                    ✓ Organization active - tracking enabled
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <button
                                onClick={handleChangeOrganization}
                                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                            >
                                Change Organization
                            </button>
                            <button
                                onClick={handleLogout}
                                className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="p-4">
            <button
                onClick={handleLogin}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
                Login with Google
            </button>
        </div>
    );
}