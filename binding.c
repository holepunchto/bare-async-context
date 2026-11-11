#include <assert.h>
#include <bare.h>
#include <js.h>

// Stopgap: the published bare-headers don't have these yet. Declaring them
// here lets the addon compile today; remove once bare-headers ships them.
int js_get_continuation_data(js_env_t *env, js_value_t *symbol,
                             js_value_t **result);
int js_set_continuation_data(js_env_t *env, js_value_t *symbol,
                             js_value_t *value);

static js_value_t *bare_async_context_get(js_env_t *env,
                                          js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  js_value_t *result;
  err = js_get_continuation_data(env, argv[0], &result);
  if (err < 0)
    return NULL;

  return result;
}

static js_value_t *bare_async_context_set(js_env_t *env,
                                          js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  err = js_set_continuation_data(env, argv[0], argv[1]);
  (void)err;

  return NULL;
}

static js_value_t *bare_async_context_exports(js_env_t *env,
                                              js_value_t *exports) {
  int err;

#define V(name, fn)                                                            \
  {                                                                            \
    js_value_t *val;                                                           \
    err = js_create_function(env, name, -1, fn, NULL, &val);                   \
    assert(err == 0);                                                          \
    err = js_set_named_property(env, exports, name, val);                      \
    assert(err == 0);                                                          \
  }

  V("get", bare_async_context_get)
  V("set", bare_async_context_set)
#undef V

  return exports;
}

BARE_MODULE(bare_async_context, bare_async_context_exports)
