use std::env;

const MAIN_ENVIRONMENTS: [&str; 3] = ["development", "staging", "production"];

pub fn is_build() -> bool {
    env::var("GITHUB_ACTIONS").is_ok()
}

pub fn is_local() -> bool {
    env::var("SST_DEV").is_ok() || env::var("IS_LOCAL").is_ok() || matches!(env::var("IS_DEPLOYED_STAGE"), Ok(value) if value != "true")
}

pub fn environment() -> Option<String> {
    env::var("NODE_ENV").ok().filter(|value| MAIN_ENVIRONMENTS.contains(&value.as_str()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    /// Env-var tests must be serialized because env vars are process-global.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn env_helpers_work() {
        let _guard = ENV_LOCK.lock().unwrap();

        // Save originals so we can restore them after the test.
        let saved_sst_dev = env::var("SST_DEV").ok();
        let saved_is_local = env::var("IS_LOCAL").ok();
        let saved_is_deployed = env::var("IS_DEPLOYED_STAGE").ok();

        // Clear all vars that affect is_local().
        env::remove_var("SST_DEV");
        env::remove_var("IS_LOCAL");

        // IS_DEPLOYED_STAGE set to non-"true" makes is_local() return true.
        env::set_var("IS_DEPLOYED_STAGE", "preview");
        assert!(is_local());

        // With IS_DEPLOYED_STAGE also removed and no other vars set, is_local()
        // should return false (IS_DEPLOYED_STAGE not set means var() returns Err,
        // which doesn't match the Ok(value) guard).
        env::remove_var("IS_DEPLOYED_STAGE");
        assert!(!is_local());

        // Restore env vars.
        match saved_sst_dev {
            Some(val) => env::set_var("SST_DEV", val),
            None => env::remove_var("SST_DEV"),
        }
        match saved_is_local {
            Some(val) => env::set_var("IS_LOCAL", val),
            None => env::remove_var("IS_LOCAL"),
        }
        match saved_is_deployed {
            Some(val) => env::set_var("IS_DEPLOYED_STAGE", val),
            None => env::remove_var("IS_DEPLOYED_STAGE"),
        }
    }
}
