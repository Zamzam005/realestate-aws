/**
 * Reads EC2 instance identity using IMDSv2 (token required - IMDSv1 is
 * disabled on the launch template for security).
 *
 * This is what powers the "Served by" badge on the landing page. During the
 * presentation you refresh the page and the instance ID / AZ flips between
 * Private Subnet A and Private Subnet B - live proof that the Application
 * Load Balancer and Auto Scaling group are working.
 */

const IMDS = "http://169.254.169.254";
let cache = null;
let cachedAt = 0;

async function fetchWithTimeout(url, options = {}, ms = 1000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getInstanceIdentity() {
  // Cache for 5 minutes - the values never change for the life of the instance
  if (cache && Date.now() - cachedAt < 300_000) return cache;

  try {
    const tokenRes = await fetchWithTimeout(`${IMDS}/latest/api/token`, {
      method: "PUT",
      headers: { "x-aws-ec2-metadata-token-ttl-seconds": "300" },
    });
    if (!tokenRes.ok) throw new Error("no imds token");
    const token = await tokenRes.text();
    const h = { headers: { "x-aws-ec2-metadata-token": token } };

    const [instanceId, az, instanceType, localIpv4] = await Promise.all([
      fetchWithTimeout(`${IMDS}/latest/meta-data/instance-id`, h).then((r) => r.text()),
      fetchWithTimeout(`${IMDS}/latest/meta-data/placement/availability-zone`, h).then((r) => r.text()),
      fetchWithTimeout(`${IMDS}/latest/meta-data/instance-type`, h).then((r) => r.text()),
      fetchWithTimeout(`${IMDS}/latest/meta-data/local-ipv4`, h).then((r) => r.text()),
    ]);

    cache = { instanceId, availabilityZone: az, instanceType, privateIp: localIpv4, source: "imds" };
  } catch {
    // Running on a laptop, not on EC2
    cache = {
      instanceId: "local-dev",
      availabilityZone: "local",
      instanceType: "local",
      privateIp: "127.0.0.1",
      source: "local",
    };
  }

  cachedAt = Date.now();
  return cache;
}
