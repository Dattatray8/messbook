import { Button, Text, TextInput, View } from 'react-native'
import { Utensils } from 'lucide-react-native';
import { Checkbox } from 'expo-checkbox'
import { useRouter } from 'expo-router';
import '../../../global.css';

const login = () => {
  const router = useRouter();

  return (
    <View className='bg-white p-6'>
      <View className='flex-row gap-4 items-center'>
        <View className='border-8 border-[#ef8b35] rounded-lg'>
          <Utensils size={20} color={'white'} style={{ backgroundColor: '#ef8b35' }} />
        </View>
        <Text className='font-extrabold text-3xl'>MessFlow</Text>
      </View>
      <View>
        <Text>WELCOME BACK</Text>
        <View>
          <Text>Sign in to your mess.</Text>
          <Text>Keep your meals, customers, and bills moving smoothly.</Text>
        </View>
        <View>
          <View>
            <Text>Email address</Text>
            <TextInput keyboardType='email-address' placeholder='you@example.com' />
          </View>
          <View>
            <Text>Password</Text>
            <TextInput placeholder='Enter your password' />
          </View>
          <View>
            <Checkbox />
            <Text>Remember me</Text>
          </View>
          <Button title='Sign In' />
        </View>
        <Text>New to MessFlow? <Text onPress={() => router.push('/signup')}>Create an account</Text></Text>
      </View>
    </View>
  )
}

export default login
