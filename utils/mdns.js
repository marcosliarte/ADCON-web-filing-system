// Responde a consultas mDNS (ex: "adcon.local") apenas com o IP da rede local,
// para nao publicar tambem interfaces virtuais (ZeroTier, VPN, etc.) como
// bonjour-service/servicos de mDNS genericos fariam.
const mdns = require('multicast-dns');

function startMdnsResponder(hostname, ip) {
    const fqdn = `${hostname}.local`;
    const responder = mdns();

    responder.on('query', (query) => {
        const matches = query.questions.some(
            (q) => q.name.toLowerCase() === fqdn && (q.type === 'A' || q.type === 'ANY')
        );

        if (matches) {
            responder.respond({
                answers: [{ name: fqdn, type: 'A', ttl: 120, data: ip }],
            });
        }
    });

    responder.on('error', (err) => {
        console.warn(`⚠️ mDNS (${fqdn}): ${err.message}`);
    });

    console.log(`📡 mDNS ativo: http://${fqdn}:3000 -> ${ip}`);

    return responder;
}

module.exports = { startMdnsResponder };
