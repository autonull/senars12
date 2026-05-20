import type {BotContext} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';
import {AuthManager} from '../../../io/auth.js';
import {IdentityResolver} from '../../IdentityResolver.js';

export class AuthChecker implements PipelineStage {
  name = 'AuthChecker';
  priority = 2;
  enabled = () => true;
  private authManager = new AuthManager();
  private identityResolver = new IdentityResolver();

  async execute(ctx: BotContext): Promise<void> {
    const authResult = this.authManager.checkAuth(ctx.connection.id, ctx.connection.sender, ctx.turn.input.text);
    if (authResult === 'ignore') {
      ctx.turn.finalResponse = '';
      return;
    }
    if (authResult === 'auth_bound') {
      this.authManager.bindUser(ctx.connection.id, ctx.connection.sender);
      ctx.turn.finalResponse = 'Authenticated successfully';
    }

    const metadata = {
      hostmask: ctx.connection.hostmask || ctx.connection.sender,
      authId: ctx.connection.authId,
      nick: ctx.connection.nick,
      username: ctx.connection.username,
    };
    const canonicalId = this.identityResolver.resolveIdentity(ctx.connection.sender, metadata);
    ctx.connection.canonicalId = canonicalId;
  }
}