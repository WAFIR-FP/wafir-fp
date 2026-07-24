#include <array>
#include <cstdint>
#include <iomanip>
#include <sstream>
#include <string>
#include <vector>
#include "headers/sha256.h"

// Implementação adaptada de https://lucidar.me/en/dev-c-cpp/sha-256-in-c-cpp/

std::string sha256_hex(const std::string &input) {
  constexpr std::array<uint32_t, 64> k = {
      0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u,
      0x923f82a4u, 0xab1c5ed5u, 0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u,
      0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u, 0xe49b69c1u, 0xefbe4786u,
      0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
      0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u,
      0x06ca6351u, 0x14292967u, 0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u,
      0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u, 0xa2bfe8a1u, 0xa81a664bu,
      0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
      0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au,
      0x5b9cca4fu, 0x682e6ff3u, 0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u,
      0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u,
  };

  auto rotr = [](uint32_t x, uint32_t n) -> uint32_t { return (x >> n) | (x << (32u - n)); };
  auto ch = [](uint32_t x, uint32_t y, uint32_t z) -> uint32_t { return (x & y) ^ ((~x) & z); };
  auto maj = [](uint32_t x, uint32_t y, uint32_t z) -> uint32_t { return (x & y) ^ (x & z) ^ (y & z); };
  auto ep0 = [&](uint32_t x) -> uint32_t { return rotr(x, 2u) ^ rotr(x, 13u) ^ rotr(x, 22u); };
  auto ep1 = [&](uint32_t x) -> uint32_t { return rotr(x, 6u) ^ rotr(x, 11u) ^ rotr(x, 25u); };
  auto sig0 = [&](uint32_t x) -> uint32_t { return rotr(x, 7u) ^ rotr(x, 18u) ^ (x >> 3u); };
  auto sig1 = [&](uint32_t x) -> uint32_t { return rotr(x, 17u) ^ rotr(x, 19u) ^ (x >> 10u); };

  std::vector<uint8_t> data(input.begin(), input.end());
  const uint64_t bit_len = static_cast<uint64_t>(data.size()) * 8u;

  data.push_back(0x80u);
  while ((data.size() % 64u) != 56u) {
    data.push_back(0u);
  }

  for (int i = 7; i >= 0; --i) {
    data.push_back(static_cast<uint8_t>((bit_len >> static_cast<unsigned>(i * 8)) & 0xffu));
  }

  uint32_t h0 = 0x6a09e667u;
  uint32_t h1 = 0xbb67ae85u;
  uint32_t h2 = 0x3c6ef372u;
  uint32_t h3 = 0xa54ff53au;
  uint32_t h4 = 0x510e527fu;
  uint32_t h5 = 0x9b05688cu;
  uint32_t h6 = 0x1f83d9abu;
  uint32_t h7 = 0x5be0cd19u;

  for (size_t chunk = 0; chunk < data.size(); chunk += 64u) {
    uint32_t w[64]{};
    for (size_t i = 0; i < 16; ++i) {
      const size_t j = chunk + (i * 4u);
      w[i] = (static_cast<uint32_t>(data[j]) << 24u) | (static_cast<uint32_t>(data[j + 1]) << 16u) |
             (static_cast<uint32_t>(data[j + 2]) << 8u) | static_cast<uint32_t>(data[j + 3]);
    }

    for (size_t i = 16; i < 64; ++i) {
      w[i] = sig1(w[i - 2]) + w[i - 7] + sig0(w[i - 15]) + w[i - 16];
    }

    uint32_t a = h0;
    uint32_t b = h1;
    uint32_t c = h2;
    uint32_t d = h3;
    uint32_t e = h4;
    uint32_t f = h5;
    uint32_t g = h6;
    uint32_t h = h7;

    for (size_t i = 0; i < 64; ++i) {
      const uint32_t t1 = h + ep1(e) + ch(e, f, g) + k[i] + w[i];
      const uint32_t t2 = ep0(a) + maj(a, b, c);
      h = g;
      g = f;
      f = e;
      e = d + t1;
      d = c;
      c = b;
      b = a;
      a = t1 + t2;
    }

    h0 += a;
    h1 += b;
    h2 += c;
    h3 += d;
    h4 += e;
    h5 += f;
    h6 += g;
    h7 += h;
  }

  std::ostringstream out;
  out << std::hex << std::setfill('0') << std::nouppercase;
  out << std::setw(8) << h0 << std::setw(8) << h1 << std::setw(8) << h2 << std::setw(8) << h3;
  out << std::setw(8) << h4 << std::setw(8) << h5 << std::setw(8) << h6 << std::setw(8) << h7;
  return out.str();
}
