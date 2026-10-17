import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { googleOAuthConfig } from '../../config/google-oauth.config';
import { GoogleEmailNotVerifiedException } from '../exceptions/auth-exceptions';
import { OAuthProfile } from '../services/auth-provider-user.service';

/**
 * Redirect-based Google login. Unlike eterna-api's source (the reference
 * this is ported from), this rejects an unverified Google email outright —
 * eterna trusts `emails[0].value` with no check, which would let someone
 * claim an email address Google itself hasn't confirmed.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    const config = googleOAuthConfig();
    super({
      clientID: config.clientId as string,
      clientSecret: config.clientSecret as string,
      callbackURL: config.callbackUrl as string,
      scope: ['email', 'profile'],
    });
  }

  authorizationParams(): { prompt: string } {
    return { prompt: 'select_account' };
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const emailEntry = profile.emails?.[0];
    const emailVerified = emailEntry?.verified ?? profile._json?.email_verified;
    if (!emailEntry?.value || !emailVerified) {
      done(new GoogleEmailNotVerifiedException(), false);
      return;
    }

    const oauthProfile: OAuthProfile = {
      providerId: profile.id,
      email: emailEntry.value,
      name: profile.displayName,
      profilePicture: profile.photos?.[0]?.value ?? null,
    };
    done(null, oauthProfile);
  }
}
