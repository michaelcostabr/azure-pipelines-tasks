import * as tl from "vsts-task-lib/task";
import * as Q from "q";
import * as querystring from "querystring";
import { 
	HttpClient, 
	HttpClientResponse 
} from "typed-rest-client/HttpClient";

export interface IAccessToken {
	token_type: string;
	expires_in: string;
	expires_on: string;
	resource: string;
	access_token: string;

	// ignored other properties as they won't be useful in the current scenario
}

export class AuthorizationClient {
	constructor(endpoint, httpClient: HttpClient) {
		this._httpClient = httpClient; 
		this._endpoint = endpoint;
		this._defaultAuthUrl = "https://login.windows.net/";
	}

	public async getBearerToken(): Promise<any> {
		if(this._accessToken) {
			let tokenExpiryTimeInUTCSeconds: number = parseInt(this._accessToken.expires_on);
			let currentTimeInUTCSeconds: number = this._getCurrentTimeInUTCSeconds();
			if(tokenExpiryTimeInUTCSeconds > currentTimeInUTCSeconds + 60) {
				// keeping time window of 60 seconds for fetching new token
				tl.debug(`Returning authorization token from cache.`);
				return this._accessToken.access_token;
			}
		}

		tl.debug(`Authorization token not found in cache.`);
		this._accessToken = await this._refreshAccessToken();
		return this._accessToken.access_token;
	}

	private async _refreshAccessToken(): Promise<IAccessToken> {
		let deferred: Q.Deferred<IAccessToken> = Q.defer<IAccessToken>();
		
		let envAuthUrl = (this._endpoint.envAuthUrl) ? (this._endpoint.envAuthUrl) : this._defaultAuthUrl;
		let authorityUrl = envAuthUrl + this._endpoint.tenantID + "/oauth2/token/";
		let requestData = querystring.stringify({
    		resource: this._endpoint.activeDirectoryResourceId,
    		client_id: this._endpoint.servicePrincipalClientID,
    		grant_type: "client_credentials",
    		client_secret: this._endpoint.servicePrincipalKey
		});

	    let requestHeader = {
	        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
	    }

		tl.debug('Requesting for Auth Token: ' + authorityUrl);
		this._httpClient.post(authorityUrl, requestData, requestHeader)
    		.then(async (response: HttpClientResponse) => {
        		let contents: string = await response.readBody();
        		if (response.message.statusCode == 200) {
	                if(!!contents) {
	                    deferred.resolve(JSON.parse(contents));
	                }
        		}
        		else {
            		deferred.reject(tl.loc('Couldnotfetchaccesstoken', response.message.statusCode, response.message.statusMessage, contents));
        		}
    		}, (error) => {
        		deferred.reject(error);
    		}
    	);

    	return deferred.promise;
	}

	private _getCurrentTimeInUTCSeconds(): number {
		return Math.floor(new Date().getTime()/1000);
	}

	private _endpoint: any;
	private _httpClient: HttpClient;
	private _accessToken: IAccessToken;
	private _defaultAuthUrl: string;
}