import CryptoJS from "crypto-js";
import { customAlphabet } from "nanoid";

const CONFIG = {
  APP_KEY: "moviebox",
  IV: "wEiphTn!",
  KEY: "123d6cedf626dy54233aa1w6",
};

export const nanoid = customAlphabet("0123456789abcdef", 32);

export class ShowboxCrypto {
  static encrypt(data: string): string {
    return CryptoJS.TripleDES.encrypt(
      data,
      CryptoJS.enc.Utf8.parse(CONFIG.KEY),
      { iv: CryptoJS.enc.Utf8.parse(CONFIG.IV) }
    ).toString();
  }

  static generateVerify(encryptedData: string): string {
    const appKeyMd5 = CryptoJS.MD5(CONFIG.APP_KEY).toString();
    return CryptoJS.MD5(appKeyMd5 + CONFIG.KEY + encryptedData).toString();
  }

  static getAppKeyMd5(): string {
    return CryptoJS.MD5(CONFIG.APP_KEY).toString();
  }
}
