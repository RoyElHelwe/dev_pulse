# Local EVM blockchain (Anvil, from Foundry) for PulseCoin and the kitchen shop.
# Chain state is dumped to /data (the chain_data volume) so coins survive restarts.
FROM ghcr.io/foundry-rs/foundry:v1.5.1
USER root
RUN mkdir -p /data && chown foundry:foundry /data
USER foundry
EXPOSE 8545
# Instant mining (a transaction is in a block as soon as it is sent), no pre-funded accounts:
# the API funds its own relayer account at startup (anvil_setBalance).
CMD ["anvil --host 0.0.0.0 --port 8545 --chain-id ${CHAIN_ID:-31337} --accounts 0 --state /data/state.json --state-interval 5 --silent"]
