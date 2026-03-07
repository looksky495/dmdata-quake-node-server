export class DMDataSocket {
  SOCKET_START_API = "https://api.dmdata.jp/v2/socket";

  #accessToken;

  /** @type {WebSocket | null} */
  #client;

  /**
   * @param {string} accessToken
   */
  constructor (accessToken){
    this.#accessToken = accessToken;
    this.#client = null;
  }

  /**
   * @returns {Promise<void>}
   */
  async start (){

  }
}
