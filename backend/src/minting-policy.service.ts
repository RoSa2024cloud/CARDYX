type NativeScript = {
  type?: unknown;
  slot?: unknown;
  required?: unknown;
  scripts?: unknown;
};

export function nativePolicyMintingDisabled(policy: unknown, currentSlot: bigint, depth = 0): boolean {
  if (depth > 16 || policy === null || typeof policy !== 'object') return false;
  const node = policy as NativeScript;
  if (node.type === 'before') {
    try {
      return currentSlot >= BigInt(String(node.slot));
    } catch { return false; }
  }

  const scripts = Array.isArray(node.scripts) ? node.scripts : [];
  const disabledChildren = scripts.map((child) => nativePolicyMintingDisabled(child, currentSlot, depth + 1));
  if (node.type === 'all') return scripts.length > 0 && disabledChildren.some(Boolean);
  if (node.type === 'any') return scripts.length > 0 && disabledChildren.every(Boolean);
  if (node.type === 'atLeast') {
    const required = Number(node.required);
    return Number.isInteger(required) && required > 0 && disabledChildren.filter((disabled) => !disabled).length < required;
  }
  return false;
}
