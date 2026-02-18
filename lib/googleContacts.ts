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

        const data = await response.json();
        return data.resourceName; // Return the resource ID (e.g., people/12345)
    } catch (error) {
        console.error('Error saving to Google Contacts:', error);
        throw error;
    }
};

export const updateGoogleContact = async (accessToken: string, resourceName: string, contact: {
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
}) => {
    try {
        // 1. Fetch current contact to get Etag (required for update)
        const getResponse = await fetch(`https://people.googleapis.com/v1/${resourceName}?personFields=metadata`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!getResponse.ok) throw new Error('Failed to fetch contact for update');
        const currentContact = await getResponse.json();
        const etag = currentContact.etag;

        // 2. Prepare Update Body
        const body = {
            etag,
            names: [{ givenName: contact.firstName, familyName: contact.lastName || '' }],
            emailAddresses: contact.email ? [{ value: contact.email, type: 'work' }] : [],
            phoneNumbers: contact.phone ? [{ value: contact.phone, type: 'mobile' }] : [],
            organizations: contact.company ? [{ name: contact.company, title: contact.jobTitle || '' }] : []
        };

        // 3. Perform Update
        const updateResponse = await fetch(`https://people.googleapis.com/v1/${resourceName}:updateContact?updatePersonFields=names,emailAddresses,phoneNumbers,organizations`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            throw new Error(errorData.error.message || 'Failed to update contact');
        }

        return await updateResponse.json();
    } catch (error) {
        console.error('Error updating Google Contact:', error);
        throw error;
    }
};

export const searchContactByPhone = async (accessToken: string, phoneNumber: string) => {
    try {
        // Search for the contact using the phone number
        const query = encodeURIComponent(phoneNumber);
        const searchResponse = await fetch(`https://people.googleapis.com/v1/people:searchContacts?query=${query}&readMask=names,phoneNumbers,metadata`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!searchResponse.ok) throw new Error('Failed to search contact');

        const searchResult = await searchResponse.json();
        if (searchResult.results && searchResult.results.length > 0) {
            // Return the first match's resourceName
            return searchResult.results[0].person.resourceName;
        }
        return null;
    } catch (error) {
        console.error('Error searching Google Contact:', error);
        return null;
    }
};

export const deleteGoogleContact = async (accessToken: string, resourceName: string) => {
    try {
        const response = await fetch(`https://people.googleapis.com/v1/${resourceName}:deleteContact`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || 'Failed to delete contact');
        }

        return true;
    } catch (error) {
        console.error('Error deleting Google Contact:', error);
        throw error; // Rethrow to let caller know
    }
};
