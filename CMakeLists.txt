cmake_minimum_required(VERSION 4.0)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)

project(bare_async_context C)

add_bare_module(bare_async_context)

target_sources(
  ${bare_async_context}
  PRIVATE
    binding.c
)
