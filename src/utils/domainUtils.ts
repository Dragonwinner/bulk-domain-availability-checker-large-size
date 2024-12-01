export const validateDomain = (domain: string): boolean => {
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
};

export const checkDomainAvailability = async (domain: string): Promise<boolean> => {
  try {
    // Check using multiple DNS providers for better accuracy
    const [googleResponse, cloudflareResponse] = await Promise.all([
      fetch(`https://dns.google/resolve?name=${domain}&type=ANY`),
      fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=ANY`, {
        headers: { 'Accept': 'application/dns-json' }
      })
    ]);

    const [googleData, cloudflareData] = await Promise.all([
      googleResponse.json(),
      cloudflareResponse.json()
    ]);

    // Check for common DNS records that indicate domain registration
    const hasGoogleRecords = googleData.Answer?.length > 0;
    const hasCloudflareRecords = cloudflareData.Answer?.length > 0;
    
    // Additional checks for specific record types
    const hasSOA = googleData.Answer?.some((record: any) => record.type === 6) ||
                   cloudflareData.Answer?.some((record: any) => record.type === 6);
    
    // Domain is considered registered if it has DNS records or SOA record
    return !hasGoogleRecords && !hasCloudflareRecords && !hasSOA;
  } catch (error) {
    throw new Error(`Failed to check domain: ${error.message}`);
  }
};

export const processDomainBatch = async (
  domains: string[],
  timeout: number
): Promise<Map<string, boolean>> => {
  const results = new Map<string, boolean>();
  
  await Promise.all(
    domains.map(async (domain) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const isAvailable = await checkDomainAvailability(domain);
        clearTimeout(timeoutId);
        results.set(domain, isAvailable);
      } catch (error) {
        results.set(domain, false);
      }
    })
  );
  
  return results;
};

export const exportDomains = (
  results: { domain: string; status: string }[],
  type: 'available' | 'registered'
): string => {
  const filteredDomains = results
    .filter(result => result.status === type)
    .map(result => result.domain)
    .join('\n');
  
  return filteredDomains;
};