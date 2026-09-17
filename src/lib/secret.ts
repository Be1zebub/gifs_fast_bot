export async function secretsEqual(left: string, right: string): Promise<boolean> {
	const encoder = new TextEncoder()
	const [leftHash, rightHash] = await Promise.all([
		crypto.subtle.digest("SHA-256", encoder.encode(left)),
		crypto.subtle.digest("SHA-256", encoder.encode(right)),
	])
	return timingSafeEqual(new Uint8Array(leftHash), new Uint8Array(rightHash))
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
	if (left.byteLength !== right.byteLength) return false
	let diff = 0
	for (let i = 0; i < left.byteLength; i++) {
		diff |= (left[i] ?? 0) ^ (right[i] ?? 0)
	}
	return diff === 0
}
