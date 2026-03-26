from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import os

os.makedirs("keys", exist_ok=True)
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
with open("keys/private.pem", "wb") as f:
    f.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
with open("keys/public.pem", "wb") as f:
    f.write(key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
print("Keys generated.")
