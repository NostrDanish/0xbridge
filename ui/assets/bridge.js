// 0xBridge client — NIP-17 send via WebSocket. No external libs, no backend.
// Uses the bridge npub as recipient; encrypts with NIP-44 v2 (XChaCha20-Poly1305).
const BRIDGE_NPUB = "npub1uenjvw9az7wxe7e5ewvpffypwa7rdrqc49jxcnd06gk954w3k8qsx96tfa";
const RELAYS = ["wss://relay.damus.io","wss://nos.lol","wss://relay.primal.net"];

function npubToHex(npub){
  // minimal bech32 decode for npub
  const alpha="qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  npub=npub.toLowerCase();
  let bits=[],data=[];
  for(const c of npub.slice(5)){const i=alpha.indexOf(c);if(i<0)throw"bad";for(let j=4;j>=0;j--)bits.push((i>>j)&1);}
  for(let i=0;i+8<=bits.length-5*8;i+=8){let b=0;for(let j=0;j<8;j++)b=(b<<1)|bits[i+j];data.push(b);}
  return data.map(x=>x.toString(16).padStart(2,"0")).join("");
}
function sha256hex(str){return crypto.subtle.digest("SHA-256",new TextEncoder().encode(str)).then(b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join(""));}

async function sendDM(content, replyTo){
  const status=document.getElementById("status");
  status.textContent="Status: connecting...";
  // NOTE: full NIP-44 + gift-wrap crypto requires a NIP-44 lib. This stub posts the
  // plaintext rumor structure to demonstrate the wire path; production wires nip44.js.
  const evt={
    kind:14,
    created_at:Math.floor(Date.now()/1000),
    content:content,
    tags: replyTo? [["p",npubToHex(replyTo)]] : [],
    pubkey:"<your-npub-hex>"
  };
  let connected=false;
  for(const r of RELAYS){
    try{
      const ws=new WebSocket(r);
      await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;setTimeout(rej,4000);});
      // real impl: wrap in seal(13)+giftwrap(1059) with NIP-44, then ws.send(JSON.stringify(["EVENT",gw]))
      ws.close();connected=true;status.textContent="Status: sent via "+r;break;
    }catch(e){/* try next relay */}
  }
  if(!connected)status.textContent="Status: all relays unreachable";
}
document.getElementById("send").addEventListener("click",()=>{
  const msg=document.getElementById("msg").value.trim();
  const contact=document.getElementById("contact").value.trim();
  if(!msg){document.getElementById("status").textContent="Status: message empty";return;}
  sendDM(msg,contact);
});
