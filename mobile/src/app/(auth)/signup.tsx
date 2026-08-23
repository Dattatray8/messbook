import Checkbox from 'expo-checkbox'
import { useRouter } from 'expo-router';
import { Utensils } from 'lucide-react-native'
import { Button, Text, TextInput, View } from 'react-native'

const signup = () => {
    const router = useRouter();

    return (
        <View>
            <View>
                <Utensils size={24} />
                <Text>MessFlow</Text>
            </View>
            <View>
                <Text>START SIMPLY</Text>
                <View>
                    <Text>Set up your mess.</Text>
                    <Text>Join owners who are leaving the notebook behind.</Text>
                </View>
                <View>
                    <View>
                        <Text>Your name</Text>
                        <TextInput placeholder='Ramesh Kumar' />
                    </View>
                    <View>
                        <Text>Phone number</Text>
                        <TextInput keyboardType='phone-pad' placeholder='98575 XXXXX' />
                    </View>
                    <View>
                        <Text>Email address</Text>
                        <TextInput keyboardType='email-address' placeholder='you@example.com' />
                    </View>
                    <View>
                        <Text>Create a password</Text>
                        <TextInput placeholder='At least 8 characters' />
                    </View>
                    <Button title='Create Account' />
                </View>
                <Text>Already have an account? <Text onPress={() => router.push('/login')}>Sign in</Text></Text>
            </View>
        </View>
    )
}

export default signup
