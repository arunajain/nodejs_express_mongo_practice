import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenPair,
} from "./auth.type.js";
import JwtService from "./jwt.service.js";
import config from "../config/index.js";
class TokenService {
  static generateAccessToken(payload: AccessTokenPayload): string {
    return JwtService.sign(
      payload,
      config.jwt.secret,
      config.jwt.accessExpiresIn,
    );
  }

  static generateRefreshToken(payload: RefreshTokenPayload): string {
    return JwtService.sign(
      payload,
      config.jwt.refreshSecret,
      config.jwt.refreshExpiresIn,
    );
  }

  static generateTokenPair(user: AccessTokenPayload): TokenPair {
    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken({ userId: user.userId }),
    };
  }

  static verifyAccessToken(token: string): AccessTokenPayload {
    return JwtService.verify<AccessTokenPayload>(token, config.jwt.secret);
  }

  static verifyRefreshToken(token: string): RefreshTokenPayload {
    return JwtService.verify<RefreshTokenPayload>(
      token,
      config.jwt.refreshSecret,
    );
  }
}
export default TokenService;
