export const convertObjectToArray = (object) => {
    if(typeof object === 'string'){
        // Try to parse as json
        try {
            object = JSON.parse(object)
        } catch (error) {
            return []
        }
    }
    return Object.entries(object).map(([key, value]) => ({ key, value }))
}