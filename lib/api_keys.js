"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addApiKeysToApi = void 0;
/**
 * addApiKeysToApi will add the provided API keys to the api with usage plan.
 */
function addApiKeysToApi(api, apiKeys) {
    apiKeys.forEach((descr) => {
        const apiKey = api.addApiKey(`ApiKey-${descr.name}`, {
            apiKeyName: descr.name,
        });
        const usagePlan = api.addUsagePlan(`UsagePlan-${descr.name}`, {
            name: descr.name,
            apiKey: apiKey,
            throttle: descr.throttle ? descr.throttle : {
                rateLimit: 500,
                burstLimit: 750,
            }
        });
        usagePlan.addApiStage({
            stage: api.deploymentStage,
        });
    });
}
exports.addApiKeysToApi = addApiKeysToApi;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpX2tleXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhcGlfa2V5cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFRQTs7R0FFRztBQUNILFNBQWdCLGVBQWUsQ0FBQyxHQUF1QixFQUFFLE9BQXNCO0lBQzNFLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFrQixFQUFFLEVBQUU7UUFDbkMsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxVQUFVLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUNqRCxVQUFVLEVBQUUsS0FBSyxDQUFDLElBQUk7U0FDekIsQ0FBQyxDQUFBO1FBQ0YsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxhQUFhLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUMxRCxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7WUFDaEIsTUFBTSxFQUFFLE1BQU07WUFDZCxRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hDLFNBQVMsRUFBRSxHQUFHO2dCQUNkLFVBQVUsRUFBRSxHQUFHO2FBQ2xCO1NBQ0osQ0FBQyxDQUFBO1FBQ0YsU0FBUyxDQUFDLFdBQVcsQ0FBQztZQUNsQixLQUFLLEVBQUUsR0FBRyxDQUFDLGVBQWU7U0FDN0IsQ0FBQyxDQUFBO0lBRU4sQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDO0FBbEJELDBDQWtCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSBcIkBhd3MtY2RrL2F3cy1hcGlnYXRld2F5XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXBpS2V5RGVzY3Ige1xuICAgIHJlYWRvbmx5IG5hbWU6IHN0cmluZztcbiAgICByZWFkb25seSBpZD86IHN0cmluZzsgLy8gRGVwcmVjYXRlZFxuICAgIHJlYWRvbmx5IHRocm90dGxlPzogYXBpZ2F0ZXdheS5UaHJvdHRsZVNldHRpbmdzO1xufVxuXG4vKipcbiAqIGFkZEFwaUtleXNUb0FwaSB3aWxsIGFkZCB0aGUgcHJvdmlkZWQgQVBJIGtleXMgdG8gdGhlIGFwaSB3aXRoIHVzYWdlIHBsYW4uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhZGRBcGlLZXlzVG9BcGkoYXBpOiBhcGlnYXRld2F5LlJlc3RBcGksIGFwaUtleXM6IEFwaUtleURlc2NyW10pIHtcbiAgICBhcGlLZXlzLmZvckVhY2goKGRlc2NyOiBBcGlLZXlEZXNjcikgPT4ge1xuICAgICAgICBjb25zdCBhcGlLZXkgPSBhcGkuYWRkQXBpS2V5KGBBcGlLZXktJHtkZXNjci5uYW1lfWAsIHtcbiAgICAgICAgICAgIGFwaUtleU5hbWU6IGRlc2NyLm5hbWUsXG4gICAgICAgIH0pXG4gICAgICAgIGNvbnN0IHVzYWdlUGxhbiA9IGFwaS5hZGRVc2FnZVBsYW4oYFVzYWdlUGxhbi0ke2Rlc2NyLm5hbWV9YCwge1xuICAgICAgICAgICAgbmFtZTogZGVzY3IubmFtZSxcbiAgICAgICAgICAgIGFwaUtleTogYXBpS2V5LFxuICAgICAgICAgICAgdGhyb3R0bGU6IGRlc2NyLnRocm90dGxlID8gZGVzY3IudGhyb3R0bGUgOiB7XG4gICAgICAgICAgICAgICAgcmF0ZUxpbWl0OiA1MDAsXG4gICAgICAgICAgICAgICAgYnVyc3RMaW1pdDogNzUwLFxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICB1c2FnZVBsYW4uYWRkQXBpU3RhZ2Uoe1xuICAgICAgICAgICAgc3RhZ2U6IGFwaS5kZXBsb3ltZW50U3RhZ2UsXG4gICAgICAgIH0pXG5cbiAgICB9KTtcbn1cbiJdfQ==