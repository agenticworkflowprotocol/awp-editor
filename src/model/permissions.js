// Static evaluation of `permissions` and `approval.requiredFor` for one action (spec 5.5.3, 5.5.4,
// 7.5, 7.6). It shows what the manifest says; policies, data and model policy and runtime rules
// can still deny or require approval at run time.

/** Does a key (action, group or `prefix.*`) match an action? */
export function keyMatches(key, action, groups = {}) {
  if (key === action) return true;
  if (Array.isArray(groups[key]) && groups[key].includes(action)) return true;
  return key.endsWith('.*') && action.startsWith(key.slice(0, -1));
}

/**
 * Decision of one permissions object for an action.
 * @returns {{ allowed: boolean, reason: string, key?: string, resources?: string[] }}
 */
export function decide(permissions, action, groups = {}) {
  if (!permissions || typeof permissions !== 'object') return { allowed: true, reason: 'no permissions object (spec 7.5.3)' };
  const matches = Object.entries(permissions.tools ?? {}).filter(([key]) => keyMatches(key, action, groups));
  const denied = matches.find(([, rule]) => rule?.allow === false);
  if (denied) return { allowed: false, reason: `denied by ${denied[0]}`, key: denied[0] };
  const allowed = matches.find(([, rule]) => rule?.allow === true);
  if (allowed) {
    const resources = Array.isArray(allowed[1].resources) ? allowed[1].resources : undefined;
    return { allowed: true, reason: `allowed by ${allowed[0]}`, key: allowed[0], ...(resources ? { resources } : {}) };
  }
  const fallback = permissions.default ?? 'deny';
  return { allowed: fallback === 'allow', reason: `default: ${fallback}` };
}

/**
 * Combined decision of several permissions objects: allowed only if every one allows (spec 7.5.4).
 * @param {{ scope: string, permissions: object | undefined }[]} levels
 */
export function combine(levels, action, groups = {}) {
  const present = levels.filter((l) => l.permissions);
  if (!present.length) return { allowed: true, reason: 'no permissions object (spec 7.5.3)', levels: [] };
  const results = present.map((l) => ({ scope: l.scope, ...decide(l.permissions, action, groups) }));
  const blocker = results.find((r) => !r.allowed);
  const resources = results.flatMap((r) => r.resources ?? []);
  return {
    allowed: !blocker,
    reason: blocker ? `${blocker.scope}: ${blocker.reason}` : results.map((r) => `${r.scope}: ${r.reason}`).join('; '),
    levels: results,
    ...(resources.length ? { resources } : {}),
  };
}

/** Keys of `approval.requiredFor` that match an action. */
export function approvalKeys(approval, action, groups = {}) {
  const keys = Array.isArray(approval?.requiredFor) ? approval.requiredFor : [];
  return keys.filter((key) => typeof key === 'string' && keyMatches(key, action, groups));
}

/** Policy shorthands of `spec.policies` and the well-known action each one denies (spec 8.1). */
export const SHORTHANDS = [
  { path: ['git', 'allowPush'], action: 'git.push' },
  { path: ['git', 'allowForcePush'], action: 'git.forcePush' },
  { path: ['pullRequest', 'allowCreate'], action: 'pullRequest.create' },
  { path: ['merge', 'allow'], action: 'git.merge' },
  { path: ['production', 'allow'], action: 'production.deploy' },
];

/** Shorthands set to `false` that deny an action, as `policies.<a>.<b>` strings. */
export function shorthandDenials(policies, action, groups = {}) {
  if (!policies || typeof policies !== 'object') return [];
  return SHORTHANDS.filter(({ path: [a, b], action: target }) => policies[a]?.[b] === false && keyMatches(target, action, groups))
    .map(({ path }) => `policies.${path.join('.')}`);
}

/** Groups (including well-known actions) that contain an action. */
export function groupsOf(action, groups = {}) {
  return Object.entries(groups).filter(([, members]) => Array.isArray(members) && members.includes(action)).map(([g]) => g);
}
