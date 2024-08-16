// XXX even though ethers is not used in the code below, it's very likely
// it will be used by any DApp, so we are already including it here
const { ethers } = require("ethers");

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

function hextostring(string) {
  return ethers.toUtf8String(string);
}

function stringtohex(payload) {
  return ethers.hexlify(ethers.toUtf8Bytes(payload));
}

let id = 1;
let positions = { somu_chair: [], treasurer: [], sec_gen: [] };
const voters = [];
const votes = [];

async function handle_advance(data) {
  console.log("Received advance request data " + JSON.stringify(data));
  let payload = data["payload"];
  const method = payload["method"];
  const sender = data["metadata"]["msg_sender"];
  console.log(sender);

  payload = JSON.parse(hextostring(payload));

  if (!(method in advance_method_handlers)) {
    const report_req = await fetch(rollup_server + "/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload: stringtohex("invalid method") }),
    });

    return "reject";
  }

  return handler(payload, sender);
}

async function handle_inspect(data) {
  console.log("Received inspect request data " + JSON.stringify(data));
  const payload = data["payload"];
  const route = hextostring(payload);
  let responseObj;

  if (route == "viewvotes") {
    responseObj = JSON.stringify(positions);
  } else {
    responseObj = "route not implemented";
  }

  const report_req = await fetch(rollup_server + "/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload: stringtohex(responseObj) }),
  });

  return "accept";
}

var handlers = {
  advance_state: handle_advance,
  inspect_state: handle_inspect,
};

// candidateName, position: called at runtime
// candidateName, candidateId, position, votes : normal candidate data structure

// {"method": "createCandidate", "candidateName": "Charles Juma", "position": "somu_chair"}

async function createCandidate(payload, sender) {
  const candidateName = payload["candidateName"];
  const position = payload["position"];

  const candidate = {
    candidateId: id,
    candidateName: candidateName,
    position: position,
    votes: 0,
  };

  // console.log(sender);

  if (!candidateId || !candidateName || !position) {
    const report_req = await fetch(rollup_server + "/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload: stringtohex("incomplete paramers") }),
    });
    return "reject";
  }

  positions[position].push(candidate);
  id += 1;

  const notice_req = await fetch(rollup_server + "/notice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payload: stringtohex("info: successful" + candidate.candidateId),
    }),
  });
}

// payload: voterName
// {"method": "createVoter", "voterName": "Charles Juma"}
//

async function createVoter(payload, sender) {
  const voterName = payload["voterName"];

  if (!voterName) {
    const report_req = await fetch(rollup_server + "/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: stringtohex("warning: not all parameters are included"),
      }),
    });

    return "reject";
  }

  voters.push(sender);
  id += 1;

  const notice_req = await fetch(rollup_server + "/notice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payload: stringtohex("info: successful" + candidate.candidateId),
    }),
  });
}

// candidateId, position
async function vote(payload, sender) {
  const position = payload["position"];
  const candidateId = payload["candidateId"];

  if (!position && !candidateId) {
    const report_req = await fetch(rollup_server + "/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: stringtohex("warning: not all parameters are included"),
      }),
    });
    return "reject";
  }

  const voted = voters.find((voter) => voter === sender);
  if (voted != -1) {
    const report_req = await fetch(rollup_server + "/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: stringtohex("warning: allready voted"),
      }),
    });

    return "reject";
  }

  voters.push(sender);
  const contestant = positions[position].find(
    (c) => c.candidateId == candidateId
  );
  positions[position][contestant].votes += 1;

  const notice_req = await fetch(rollup_server + "/notice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payload: stringtohex("successful"),
    }),
  });
}

var advance_method_handlers = {
  createCandidate: createCandidate,
  createVoter: createVoter,
  vote: vote,
};

var finish = { status: "accept" };

(async () => {
  while (true) {
    const finish_req = await fetch(rollup_server + "/finish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "accept" }),
    });

    console.log("Received finish status " + finish_req.status);

    if (finish_req.status == 202) {
      console.log("No pending rollup request, trying again");
    } else {
      const rollup_req = await finish_req.json();
      var handler = handlers[rollup_req["request_type"]];
      finish["status"] = await handler(rollup_req["data"]);
    }
  }
})();
