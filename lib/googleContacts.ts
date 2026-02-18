export const GOOGLE_CLIENT_ID = '865686131270-iv0mkjkphsm8or5gad7g1rood24s5jho.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/contacts';

interface GoogleTokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
    error?: string;
}

let tokenClient: any;

export const initGoogleClient = (onTokenReceived: (token: string) => void) => {
    if (typeof window === 'undefined' || !(window as any).google) {
        console.error('Google Identity Services script not loaded');
        return;
    }

    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (response: GoogleTokenResponse) => {
            if (response.error) {
                console.error('Google Auth Error:', response);
                return;
            }
            onTokenReceived(response.access_token);
        },
    });
};

export const requestGoogleToken = () => {
    if (tokenClient) {
        tokenClient.requestAccessToken();
    } else {
        console.error('Google Client not initialized');
    }
};

export const saveContactToGoogle = async (accessToken: string, contact: {
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
}) => {
    const body = {
        names: [
            {
                givenName: contact.firstName,
                familyName: contact.lastName || '',
            },
        ],
        emailAddresses: contact.email ? [{ value: contact.email, type: 'work' }] : [],
        phoneNumbers: contact.phone ? [{ value: contact.phone, type: 'mobile' }] : [],
        organizations: contact.company ? [
            {
                name: contact.company,
                title: contact.jobTitle || '',
            },
        ] : [],
    };

    try {
        const response = await fetch('https://people.googleapis.com/v1/people:createContact?personFields=names,emailAddresses,phoneNumbers,organizations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || 'Failed to save contact');
        }

        return await response.json();
    } catch (error) {
        console.error('Error saving to Google Contacts:', error);
        throw error;
    }
};
