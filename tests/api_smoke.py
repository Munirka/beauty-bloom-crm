"""Integration checks against a local Beauty Bloom server; each test gets an isolated demo workspace."""
import uuid,urllib.parse,json,os,unittest,urllib.request,urllib.error,http.cookiejar,concurrent.futures,datetime
BASE=os.environ.get('BEAUTY_TEST_URL','http://127.0.0.1:5173')
class API:
 def __init__(self):
  self.jar=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
 def call(self,path,body=None,origin=True,token=None):
  h={};method='GET' if body is None else 'POST'
  if body is not None:h['Content-Type']='application/json'
  if origin:h['Origin']=BASE
  if token:h['Authorization']='Bearer '+token
  req=urllib.request.Request(BASE+'/api/'+path,data=None if body is None else json.dumps(body).encode(),headers=h,method=method)
  try:
   with self.opener.open(req,timeout=20) as r:return r.status,json.load(r)
  except urllib.error.HTTPError as e:return e.code,json.load(e)
class CRM(unittest.TestCase):
 def setUp(self):
  self.api=API();status,self.d=self.api.call('bootstrap');self.assertEqual(status,200)
  self.date=(datetime.date.fromisoformat(self.d['today'])+datetime.timedelta(days=1))
  while self.date.weekday()==6:self.date+=datetime.timedelta(days=1)
  self.date=str(self.date);self.m=self.d['masters'][0];self.s=self.d['services'][0]
  self.booking={'client':{'name':'Тестовый Клиент','phone':'+70000001001','email':'test@example.com','consent':True},'serviceId':self.s['id'],'masterId':self.m['id'],'date':self.date,'start':840}
 def create(self):
  code,result=self.api.call('appointments',self.booking);self.assertEqual(code,200,result);return result['id']
 def get(self,id):
  code,d=self.api.call('bootstrap');self.assertEqual(code,200);return next(a for a in d['appointments'] if a['id']==id)
 def test_01_persistence(self):
  id=self.create();a=self.get(id);self.assertEqual(a['client_name'],'Тестовый Клиент');self.assertEqual(a['price'],9000)
 def test_02_conflict_and_adjacent(self):
  self.create();code,_=self.api.call('appointments',self.booking);self.assertEqual(code,409)
  for start,expected in [(870,409),(930,200)]:
   self.booking['start']=start;code,res=self.api.call('appointments',self.booking);self.assertEqual(code,expected,res)
 def test_03_concurrent_slot(self):
  with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
   results=list(pool.map(lambda _:self.api.call('appointments',self.booking),range(2)))
  self.assertEqual(sorted(r[0] for r in results),[200,409])
 def test_04_cancel_releases_slot_and_jobs(self):
  id=self.create();a=self.get(id);code,_=self.api.call('appointments/status',{'id':id,'version':a['version'],'status':'cancelled'});self.assertEqual(code,200)
  code,d=self.api.call('bootstrap');self.assertTrue(all(j['status']=='cancelled' for j in d['jobs'] if j['appointment_id']==id))
  self.create()
 def test_05_reschedule_and_stale_write(self):
  id=self.create();code,r=self.api.call('appointments/move',{'id':id,'version':1,'date':self.date,'start':1020,'masterId':self.m['id']});self.assertEqual(code,200,r)
  code,_=self.api.call('appointments/status',{'id':id,'version':1,'status':'cancelled'});self.assertEqual(code,409)
  a=self.get(id);self.assertEqual(a['start'],1020);self.assertEqual(a['status'],'confirmed')
  _,d=self.api.call('bootstrap');self.assertTrue(any(j['status']=='pending' for j in d['jobs'] if j['appointment_id']==id))
 def test_06_completion_rebook_and_revenue(self):
  id=self.create();code,r=self.api.call('appointments/status',{'id':id,'version':1,'status':'completed'});self.assertEqual(code,200,r)
  _,d=self.api.call('bootstrap');self.assertEqual(next(a['status'] for a in d['appointments'] if a['id']==id),'completed')
  self.assertEqual(len([j for j in d['jobs'] if j['appointment_id']==id and j['kind']=='rebook']),1)
  code,_=self.api.call('appointments/status',{'id':id,'version':1,'status':'completed'});self.assertEqual(code,409)
 def test_07_role_enforced_on_server(self):
  code,_=self.api.call('session/role',{'role':'master','masterId':self.m['id']});self.assertEqual(code,200)
  code,d=self.api.call('bootstrap');self.assertEqual(code,200);self.assertTrue(all(a['master_id']==self.m['id'] for a in d['appointments']))
  code,_=self.api.call('appointments',self.booking);self.assertEqual(code,403)
  code,_=self.api.call('settings',{'confirmation':False,'reminder':False,'rebook':False});self.assertEqual(code,403)
 def test_08_workspace_isolation(self):
  other=API();_,d=other.call('bootstrap');self.assertNotEqual(d['workspaceId'],self.d['workspaceId'])
  id=self.create();code,_=other.call('appointments/status',{'id':id,'version':1,'status':'cancelled'});self.assertEqual(code,404)
  self.assertFalse(any(a['id']==id for a in other.call('bootstrap')[1]['appointments']))
 def test_09_public_booking_and_privacy(self):
  visitor=API();path='public?studio='+self.d['workspaceId'];code,d=visitor.call(path);self.assertEqual(code,200)
  self.assertFalse(any('client_name' in a or 'client_phone' in a or 'email' in a for a in d['appointments']))
  code,r=visitor.call(path,self.booking);self.assertEqual(code,200,r);self.assertEqual(self.get(r['id'])['source'],'online')
  self.booking['start']=930;self.booking['client']['email']='real@external.test';code,_=visitor.call(path,self.booking);self.assertEqual(code,400)
 def test_10_validation_and_csrf(self):
  code,_=self.api.call('appointments',self.booking,origin=False);self.assertEqual(code,403)
  self.booking['date']='2026-02-31';code,_=self.api.call('appointments',self.booking);self.assertEqual(code,400)
  self.booking['date']=self.date;self.booking['masterId']=self.d['masters'][2]['id'];code,_=self.api.call('appointments',self.booking);self.assertEqual(code,409)
 def test_11_demo_cannot_deliver_real_email(self):
  self.create();code,r=self.api.call('integration/key',{});self.assertEqual(code,200)
  code,claim=self.api.call('integration/claim',{},token=r['token']);self.assertEqual(code,200);self.assertEqual(claim,{'mode':'demo','jobs':[]})
  code,_=self.api.call('automation/test-mode',{'enabled':True});self.assertEqual(code,403)
  self.assertFalse(self.d['settings']['testAvailable']);self.assertIsNone(self.d['settings']['testEmail'])
 def test_12_working_hours_and_service_snapshot(self):
  id=self.create();code,r=self.api.call('services',{**self.s,'id':self.s['id'],'active':True,'price':11000,'duration':120});self.assertEqual(code,200,r)
  a=self.get(id);self.assertEqual(a['price'],9000);self.assertEqual(a['duration'],90)
  code,r=self.api.call('masters',{**self.m,'id':self.m['id'],'active':True,'end':750});self.assertEqual(code,409,r)
 def test_13_consent_and_paused_flows(self):
  self.booking['client']['consent']=False;id=self.create();_,d=self.api.call('bootstrap');self.assertTrue(all(j['status']=='skipped' for j in d['jobs'] if j['appointment_id']==id))
  code,_=self.api.call('settings',{'confirmation':False,'reminder':False,'rebook':False});self.assertEqual(code,200)
  code,r=self.api.call('automation/demo',{});self.assertEqual(code,200);self.assertEqual(r['count'],0)
@unittest.skipUnless(os.environ.get('BEAUTY_TEST_OPERATOR')=='1', 'requires local fake operator/recipient .env.local')
class ControlledDelivery(unittest.TestCase):
 def setUp(self):
  self.assertIn(urllib.parse.urlparse(BASE).hostname,('127.0.0.1','localhost'))
  self.api=API();self.api.call('bootstrap')
  with self.api.opener.open(BASE+'/signin-with-chatgpt?return_to=/',timeout=20) as response:response.read()
  _,self.d=self.api.call('bootstrap');self.assertTrue(self.d['settings']['testAvailable'])
  self.assertEqual(self.d['settings']['testEmail'],'delivery@controlled.test')
  self.original=dict(self.d['settings']);self.ids=[]
  self.assertEqual(self.api.call('automation/test-mode',{'enabled':True})[0],200)
  self.api.call('settings',{'confirmation':True,'reminder':True,'rebook':True})
  _,self.d=self.api.call('bootstrap')
  self.m=self.d['masters'][0];self.s=self.d['services'][0]
  self.booking={'client':{'name':'Проверка доставки','phone':'+7'+str(uuid.uuid4().int)[:10],'email':'delivery@controlled.test','consent':True},'serviceId':self.s['id'],'masterId':self.m['id']}
  code,r=self.api.call('integration/key',{});self.assertEqual(code,200);self.token=r['token']
 def tearDown(self):
  for id in self.ids:
   _,d=self.api.call('bootstrap');a=next(a for a in d['appointments'] if a['id']==id)
   if a['status']=='confirmed':
    self.assertEqual(self.api.call('appointments/status',{'id':id,'version':a['version'],'status':'cancelled'})[0],200)
   for job in d['jobs']:
    if job['appointment_id']==id and job['status']=='processing':
     self.api.call('integration/ack',{'id':job['id'],'lease':job['lease'],'success':True},token=self.token)
  if hasattr(self,'original'):
   self.api.call('automation/test-mode',{'enabled':self.original['deliveryMode']=='test'})
   self.api.call('settings',{k:bool(self.original[k]) for k in ('confirmation','reminder','rebook')})
 def create(self,email=None,public=False):
  _,d=self.api.call('bootstrap');slot=None
  for offset in range(65,90):
   date=datetime.date.fromisoformat(d['today'])+datetime.timedelta(days=offset)
   if (date.weekday()+1)%7 not in self.m['days']:continue
   for start in range(self.m['start'],self.m['end']-self.s['duration']+1,30):
    if not any(a['date']==str(date) and a['master_id']==self.m['id'] and a['status'] not in ('cancelled','no_show') and a['start']<start+self.s['duration'] and a['start']+a['duration']>start for a in d['appointments']):
     slot=(str(date),start);break
   if slot:break
  self.assertIsNotNone(slot);self.booking.update({'date':slot[0],'start':slot[1]})
  body=json.loads(json.dumps(self.booking))
  if email:body['client']['email']=email
  code,r=self.api.call('public?studio='+self.d['workspaceId'] if public else 'appointments',body)
  self.assertEqual(code,200,r);self.ids.append(r['id']);return r['id']
 def claim(self):
  code,r=self.api.call('integration/claim',{},token=self.token);self.assertEqual(code,200);return r
 def test_claim_filter_and_lease(self):
  id=self.create();self.booking['start']=930;self.create('ignored@example.com')
  claim=self.claim();self.assertEqual(claim['mode'],'test');self.assertTrue(claim['jobs'])
  self.assertTrue(all(j['email']=='delivery@controlled.test' and j['message'].startswith('[ТЕСТ Beauty Bloom]') for j in claim['jobs']))
  self.assertEqual(self.claim()['jobs'],[])
  job=next(j for j in claim['jobs'] if j['kind']=='confirmation')
  self.assertEqual(self.api.call('integration/ack',{'id':job['id'],'lease':'wrong','success':True},token=self.token)[0],409)
  payload={'id':job['id'],'lease':job['lease'],'success':True}
  self.assertEqual(self.api.call('integration/ack',payload,token=self.token)[0],200)
  self.assertEqual(self.api.call('integration/ack',payload,token=self.token)[0],409)
  self.api.call('automation/test-mode',{'enabled':False});self.assertEqual(self.claim(),{'mode':'demo','jobs':[]})
 def test_public_allowed_address_and_privacy(self):
  code,d=self.api.call('public?studio='+self.d['workspaceId']);self.assertEqual(code,200);self.assertTrue(d['testBooking'])
  self.assertNotIn('delivery@controlled.test',json.dumps(d))
  self.create(public=True);self.booking['start']=930;self.booking['client']['email']='other@controlled.test'
  self.assertEqual(self.api.call('public?studio='+self.d['workspaceId'],self.booking)[0],400)
 def test_accelerate_reminder_and_rebook(self):
  id=self.create();self.claim()
  _,d=self.api.call('bootstrap');reminder=next(j for j in d['jobs'] if j['appointment_id']==id and j['kind']=='reminder')
  self.assertGreater(reminder['due_at'],d['now'])
  self.assertEqual(self.api.call('automation/demo',{})[0],409)
  self.assertEqual(self.api.call('automation/test-ready',{'id':reminder['id']})[0],200)
  rem=next(j for j in self.claim()['jobs'] if j['id']==reminder['id'])
  self.assertEqual(self.api.call('integration/ack',{'id':rem['id'],'lease':rem['lease'],'success':False,'error':'Controlled SMTP failure'},token=self.token)[0],200)
  self.assertEqual(self.claim()['jobs'],[])
  _,d=self.api.call('bootstrap');a=next(a for a in d['appointments'] if a['id']==id)
  self.assertEqual(self.api.call('appointments/status',{'id':id,'version':a['version'],'status':'completed'})[0],200)
  _,d=self.api.call('bootstrap');rebook=next(j for j in d['jobs'] if j['appointment_id']==id and j['kind']=='rebook')
  self.assertEqual(self.api.call('automation/test-ready',{'id':rebook['id']})[0],200)
  self.assertEqual([j['kind'] for j in self.claim()['jobs']],['rebook'])
if __name__=='__main__':unittest.main(verbosity=2)
