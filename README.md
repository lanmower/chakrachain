# CHAKRACHAIN alpha

What is **CHAKRACHAIN**?. 

A **blockchain** written in **node.js** that uses **hyperswarm** for p2p and **hyperswarm**

### STATUS

This project has seen its second refactor and has about 80% of its starting features implemented, those features are being tested while the rest is being written.

The  project is currently supplying the working smart contract platform as a single testnet node, the concensus algorithm is being written and tested.

# WHY

There are no other good Javascript solutions currently, node.js allows for **polymorphic** code and easy **smart contracts** while making the code concise, easy to audit and refactor, and allows the focus to be on the logistics of operation.

## DESIGN

The node will create two data directories currently: **state** has the current state **blocklog** has the block history, a tx log is also made in **txlog**.

The **DAT** protocol tools are used to communicate and store information, this allows for polymorphism (similar code running the process from node->webserver->web client and web client->webserver->node)

## CONFIGURATION

The node uses **dotenv** to configure itself, this means you can pass environment variables to it or use the **.env** file to configure it, currently a small set of configuration options are supported

#### DISCORD
A discord bot token, this blockchain has a discord bot plugged into it acting as an oracle for interactions on discord, it records transactions as itself on its own smart contract.

#### PUB
An nacl signing pubkey

#### SECRET
An nacl signing secret key

# CLIENTS

You can create **hyperdrive** clients for your **chakrachain** node. This allows you to stream updates in real time to your dapp websites... An example of how to do this is currently residing in the **chakrawallet** project.

The hyperdrive link is one-way communications from a node to dapp web hosts, and it provides data updates.

There is also a **hyperswarm** network for receiving signed transactions, **chakrachain** nodes can receive transactions seamlessly over that p2p network, allowing your dapps to communicate signed transactions back to the **chakrachain** node.

The hyperswarm link is one-way communications from any dapp to any block producing node, and allows the processing of authenticated transactions by adding them to the next block.


# NODES

**chakrachain** nodes store their information locally using:
- **hyperlog** as a block log and tx log
- **hyperdrive** as a state table

Public communication occurs using **hyperswarm** and a pubsub mechanism, this is how blocks, verifications, and transaction requests are communicated.

## BLOCKS

When blocks are created on  **chakrachain** a node processes one or more transactions to produce a write log.

The successful transactions, failed transactions and write log 

The write log serves as a log of all changes made to the state **hyperdrive**
There is also a block log and a transaction log, stored using **hypercore**

## CONCENSUS (wip)

Block validity can be verified by replaying its transactions and comparing the write logs.

**TODO:** A prototype needs to be written to take a block received via the **hyperswarm** pubsub and validate it if the node is selected for the next block's validators.

**TODO:** All nodes selected for block production should attempt to process a block as soon as possible and supply it as soon as a transaction is available to process.

Validators and nodes can register on the blockchain, nodes and validators are randomly selected

## Runnig a node

The nodes have no external requirements, a simple npm install should install what is needed. **hyperswarm** will provide the necessary connection bootstrapping.

**TODO** when a node is launched bootstrap the blockchain history in order to set up initial state...
